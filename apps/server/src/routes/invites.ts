import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { invite, membership } from "../db/schema/membership.js";
import { ConflictError, ForbiddenError, NotFoundError, sendHttpError } from "../rooms/errors.js";
import { runRekey } from "../rooms/rekey.js";
import { inviteCreateSchema, inviteLookupSchema, inviteRedeemSchema } from "./schemas.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// An unexpired, unredeemed, unrevoked invite row for tokenHash — the one condition every
// lookup and redemption must pass, expressed once so they can never drift apart.
function liveInviteWhere(tokenHash: string, now: Date) {
  return and(
    eq(invite.tokenHash, tokenHash),
    gt(invite.expiresAt, now),
    isNull(invite.redeemedAt),
    isNull(invite.revokedAt),
  );
}

export function inviteRoutes(app: FastifyInstance) {
  app.post("/rooms/:roomId/invites", { preHandler: requireSession }, async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const body = inviteCreateSchema.parse(request.body);

    try {
      const [acting] = await db
        .select()
        .from(membership)
        .where(
          and(
            eq(membership.roomId, roomId),
            eq(membership.userId, request.userId),
            isNull(membership.removedAt),
          ),
        );
      if (!acting || (acting.role !== "owner" && acting.role !== "admin")) {
        throw new ForbiddenError("owner or admin role required to create an invite");
      }
      if (body.grantsRole === "admin" && acting.role !== "owner") {
        throw new ForbiddenError("only the owner may grant the admin role");
      }

      const [created] = await db
        .insert(invite)
        .values({
          roomId,
          tokenHash: body.tokenHash,
          grantsRole: body.grantsRole,
          wrappedRoomKey: body.wrappedRoomKey,
          wrappedRoomKeyEpoch: body.wrappedRoomKeyEpoch,
          createdBy: request.userId,
          expiresAt: body.expiresAt,
        })
        .returning();

      return reply.status(201).send(created);
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.post("/invites/lookup", async (request, reply) => {
    const body = inviteLookupSchema.parse(request.body);
    const tokenHash = hashToken(body.token);

    const [row] = await db.select().from(invite).where(liveInviteWhere(tokenHash, new Date()));
    if (!row) {
      return reply.status(404).send({ error: "invite not found" });
    }

    return {
      roomId: row.roomId,
      grantsRole: row.grantsRole,
      wrappedRoomKey: row.wrappedRoomKey,
      wrappedRoomKeyEpoch: row.wrappedRoomKeyEpoch,
      expiresAt: row.expiresAt,
    };
  });

  app.post("/invites/redeem", { preHandler: requireSession }, async (request, reply) => {
    const body = inviteRedeemSchema.parse(request.body);
    const tokenHash = hashToken(body.token);

    try {
      const result = await db.transaction(async (tx) => {
        const [inviteRow] = await tx
          .select()
          .from(invite)
          .where(liveInviteWhere(tokenHash, new Date()))
          .for("update");
        if (!inviteRow) {
          throw new NotFoundError("invite not found");
        }

        const [existing] = await tx
          .select()
          .from(membership)
          .where(
            and(eq(membership.roomId, inviteRow.roomId), eq(membership.userId, request.userId)),
          );
        if (existing && !existing.removedAt) {
          throw new ConflictError("already an active member of this room");
        }

        const memberAlias = existing?.memberAlias ?? randomUUID();
        const reason = inviteRow.grantsRole === "guest" ? "guest_joined" : "member_joined";

        const rekeyResult = await runRekey(tx, {
          roomId: inviteRow.roomId,
          expectedEpoch: body.expectedEpoch,
          reason,
          nameCiphertext: body.nameCiphertext,
          envelopes: body.envelopes,
          async mutateMembership(innerTx, newEpoch) {
            if (existing) {
              // rejoin after removal: keep the existing memberAlias, since fix.(roomId,
              // authorAlias) is a foreign key onto membership.(roomId, memberAlias) and rotating
              // it would orphan any surviving fix rows.
              await innerTx
                .update(membership)
                .set({
                  role: inviteRow.grantsRole,
                  joinedEpoch: newEpoch,
                  removedAt: null,
                  displayNameCiphertext: body.displayNameCiphertext,
                })
                .where(eq(membership.id, existing.id));
            } else {
              await innerTx.insert(membership).values({
                roomId: inviteRow.roomId,
                userId: request.userId,
                memberAlias,
                displayNameCiphertext: body.displayNameCiphertext,
                role: inviteRow.grantsRole,
                joinedEpoch: newEpoch,
              });
            }
          },
        });

        await tx.update(invite).set({ redeemedAt: new Date() }).where(eq(invite.id, inviteRow.id));

        return { ...rekeyResult, roomId: inviteRow.roomId, memberAlias };
      });

      return reply.status(200).send(result);
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });
}
