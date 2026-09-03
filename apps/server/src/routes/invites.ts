import { createHash, randomUUID } from "node:crypto";

import {
  inviteCreateSchema,
  inviteLookupResponseSchema,
  inviteLookupSchema,
  inviteRedeemSchema,
  inviteResponseSchema,
  redeemResponseSchema,
  roomIdParamSchema,
} from "@tether/api";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { invite, membership } from "../db/schema/membership.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.js";
import { runRekey } from "../rooms/rekey.js";
import type { ZodTypeProvider } from "../zod-type-provider.js";
import { fromBase64, toBase64 } from "./bytes.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Every lookup and redemption must pass the same "unexpired, unredeemed, unrevoked" condition.
function liveInviteWhere(tokenHash: string, now: Date) {
  return and(
    eq(invite.tokenHash, tokenHash),
    gt(invite.expiresAt, now),
    isNull(invite.redeemedAt),
    isNull(invite.revokedAt),
  );
}

// The membership_role column also allows "owner", but inviteCreateSchema never lets a caller
// grant it — narrow here so the response type matches what invites can actually carry.
function grantableRole(role: (typeof invite.$inferSelect)["grantsRole"]) {
  if (role === "owner") {
    throw new Error("invite grantsRole must never be owner");
  }
  return role;
}

function serializeInvite(row: typeof invite.$inferSelect) {
  return {
    id: row.id,
    roomId: row.roomId,
    grantsRole: grantableRole(row.grantsRole),
    wrappedRoomKey: toBase64(row.wrappedRoomKey),
    wrappedRoomKeyEpoch: row.wrappedRoomKeyEpoch,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    redeemedAt: row.redeemedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export function inviteRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    "/rooms/:roomId/invites",
    {
      onRequest: requireSession,
      schema: {
        params: roomIdParamSchema,
        body: inviteCreateSchema,
        response: { 201: inviteResponseSchema },
      },
    },
    async (request, reply) => {
      const { roomId } = request.params;
      const body = request.body;

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
          wrappedRoomKey: fromBase64(body.wrappedRoomKey),
          wrappedRoomKeyEpoch: body.wrappedRoomKeyEpoch,
          createdBy: request.userId,
          expiresAt: new Date(body.expiresAt),
        })
        .returning();
      if (!created) {
        throw new Error("invite insert returned no row");
      }

      return reply.status(201).send(serializeInvite(created));
    },
  );

  server.post(
    "/invites/lookup",
    { schema: { body: inviteLookupSchema, response: { 200: inviteLookupResponseSchema } } },
    async (request) => {
      const body = request.body;
      const tokenHash = hashToken(body.token);

      const [row] = await db.select().from(invite).where(liveInviteWhere(tokenHash, new Date()));
      if (!row) {
        throw new NotFoundError("invite not found");
      }

      return {
        roomId: row.roomId,
        grantsRole: grantableRole(row.grantsRole),
        wrappedRoomKey: toBase64(row.wrappedRoomKey),
        wrappedRoomKeyEpoch: row.wrappedRoomKeyEpoch,
        expiresAt: row.expiresAt.toISOString(),
      };
    },
  );

  server.post(
    "/invites/redeem",
    {
      onRequest: requireSession,
      schema: { body: inviteRedeemSchema, response: { 200: redeemResponseSchema } },
    },
    async (request, reply) => {
      const body = request.body;
      const tokenHash = hashToken(body.token);

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
        const displayNameCiphertext = fromBase64(body.displayNameCiphertext);

        const rekeyResult = await runRekey(tx, {
          roomId: inviteRow.roomId,
          expectedEpoch: body.expectedEpoch,
          reason,
          nameCiphertext: fromBase64(body.nameCiphertext),
          envelopes: body.envelopes.map((envelope) => ({
            deviceId: envelope.deviceId,
            wrappedKey: fromBase64(envelope.wrappedKey),
          })),
          async mutateMembership(innerTx, newEpoch) {
            if (existing) {
              // Rejoin keeps memberAlias — rotating it would orphan fix rows via its FK onto it.
              await innerTx
                .update(membership)
                .set({
                  role: inviteRow.grantsRole,
                  joinedEpoch: newEpoch,
                  removedAt: null,
                  displayNameCiphertext,
                })
                .where(eq(membership.id, existing.id));
            } else {
              await innerTx.insert(membership).values({
                roomId: inviteRow.roomId,
                userId: request.userId,
                memberAlias,
                displayNameCiphertext,
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
    },
  );
}
