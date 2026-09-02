import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { membership } from "../db/schema/membership.js";
import { room } from "../db/schema/rooms.js";
import { ForbiddenError, NotFoundError, sendHttpError } from "../rooms/errors.js";
import { createRoom, listActiveDevices, runRekey } from "../rooms/rekey.js";
import { removalSchema, roomCreateSchema } from "./schemas.js";

async function requireActiveMembership(roomId: string, userId: string) {
  const [row] = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.roomId, roomId),
        eq(membership.userId, userId),
        isNull(membership.removedAt),
      ),
    );
  if (!row) {
    throw new NotFoundError("room not found");
  }
  return row;
}

export function roomRoutes(app: FastifyInstance) {
  app.get("/rooms", { preHandler: requireSession }, async (request) => {
    const rows = await db
      .select({
        roomId: room.id,
        currentEpoch: room.currentEpoch,
        nameCiphertext: room.nameCiphertext,
        nameEpoch: room.nameEpoch,
        precisionPolicy: room.precisionPolicy,
        approximateRadiusM: room.approximateRadiusM,
        memberAlias: membership.memberAlias,
        role: membership.role,
        joinedEpoch: membership.joinedEpoch,
      })
      .from(membership)
      .innerJoin(room, eq(room.id, membership.roomId))
      .where(and(eq(membership.userId, request.userId), isNull(membership.removedAt)));

    return { rooms: rows };
  });

  app.post("/rooms", { preHandler: requireSession }, async (request, reply) => {
    const body = roomCreateSchema.parse(request.body);
    const memberAlias = randomUUID();

    try {
      const created = await createRoom(db, {
        ...(body.roomId === undefined ? {} : { roomId: body.roomId }),
        ownerId: request.userId,
        memberAlias,
        nameCiphertext: body.nameCiphertext,
        displayNameCiphertext: body.displayNameCiphertext,
        precisionPolicy: body.precisionPolicy,
        ...(body.approximateRadiusM === undefined
          ? {}
          : { approximateRadiusM: body.approximateRadiusM }),
        envelopes: body.envelopes,
      });
      return reply.status(201).send({ room: created, memberAlias });
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.get("/rooms/:roomId/devices", { preHandler: requireSession }, async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    try {
      await requireActiveMembership(roomId, request.userId);
      const [roomRow] = await db.select().from(room).where(eq(room.id, roomId));
      if (!roomRow) {
        throw new NotFoundError("room not found");
      }
      const devices = await listActiveDevices(db, roomId, roomRow.currentEpoch);
      return { epoch: roomRow.currentEpoch, devices };
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.post("/rooms/:roomId/removals", { preHandler: requireSession }, async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const body = removalSchema.parse(request.body);

    try {
      const result = await db.transaction(async (tx) => {
        const [acting] = await tx
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
          throw new ForbiddenError("owner or admin role required to remove a member");
        }

        const [target] = await tx
          .select()
          .from(membership)
          .where(
            and(
              eq(membership.roomId, roomId),
              eq(membership.memberAlias, body.alias),
              isNull(membership.removedAt),
            ),
          );
        if (!target) {
          throw new NotFoundError("member not found");
        }
        if (target.role === "owner") {
          throw new ForbiddenError("the room owner cannot be removed");
        }

        const reason = target.role === "guest" ? "guest_removed" : "member_removed";
        const rekeyResult = await runRekey(tx, {
          roomId,
          expectedEpoch: body.expectedEpoch,
          reason,
          nameCiphertext: body.nameCiphertext,
          envelopes: body.envelopes,
          async mutateMembership(innerTx) {
            await innerTx
              .update(membership)
              .set({ removedAt: new Date() })
              .where(eq(membership.id, target.id));
          },
        });

        // device.revokedAt is global (schema has no room-scoped revocation), so only revoke when
        // the removed user holds no other active membership anywhere — otherwise their other
        // rooms' envelopes would stop too. This room's envelopes already stopped the moment
        // `removedAt` was set above; revocation here is belt-and-braces for the sweeper.
        const [otherMembership] = await tx
          .select({ id: membership.id })
          .from(membership)
          .where(and(eq(membership.userId, target.userId), isNull(membership.removedAt)));
        if (!otherMembership) {
          await tx
            .update(device)
            .set({ revokedAt: new Date() })
            .where(eq(device.userId, target.userId));
        }

        return rekeyResult;
      });

      return reply.status(200).send(result);
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });
}
