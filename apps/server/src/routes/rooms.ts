import { randomUUID } from "node:crypto";

import {
  rekeyResultSchema,
  removalSchema,
  roomCreateSchema,
  roomDevicesResponseSchema,
  roomIdParamSchema,
  roomListResponseSchema,
  roomSummarySchema,
} from "@tether/api";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { membership } from "../db/schema/membership.js";
import { room } from "../db/schema/rooms.js";
import { ForbiddenError, NotFoundError } from "../errors.js";
import { createRoom, listActiveDevices, runRekey } from "../rooms/rekey.js";
import type { ZodTypeProvider } from "../zod-type-provider.js";
import { fromBase64, toBase64 } from "./bytes.js";

async function requireActiveMembership(roomId: string, userId: string) {
  const [row] = await db
    .select({ id: membership.id })
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
}

export function roomRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    "/rooms",
    { onRequest: requireSession, schema: { response: { 200: roomListResponseSchema } } },
    async (request) => {
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

      return {
        rooms: rows.map((row) => ({ ...row, nameCiphertext: toBase64(row.nameCiphertext) })),
      };
    },
  );

  server.post(
    "/rooms",
    {
      onRequest: requireSession,
      schema: { body: roomCreateSchema, response: { 201: roomSummarySchema } },
    },
    async (request, reply) => {
      const body = request.body;
      const memberAlias = randomUUID();

      const created = await createRoom(db, {
        roomId: body.roomId,
        ownerId: request.userId,
        memberAlias,
        nameCiphertext: fromBase64(body.nameCiphertext),
        displayNameCiphertext: fromBase64(body.displayNameCiphertext),
        precisionPolicy: body.precisionPolicy,
        approximateRadiusM: body.approximateRadiusM,
        envelopes: body.envelopes.map((envelope) => ({
          deviceId: envelope.deviceId,
          wrappedKey: fromBase64(envelope.wrappedKey),
        })),
      });
      return reply.status(201).send({
        roomId: created.id,
        currentEpoch: created.currentEpoch,
        nameCiphertext: toBase64(created.nameCiphertext),
        nameEpoch: created.nameEpoch,
        precisionPolicy: created.precisionPolicy,
        approximateRadiusM: created.approximateRadiusM,
        memberAlias,
        role: "owner",
        joinedEpoch: 0,
      });
    },
  );

  server.get(
    "/rooms/:roomId/devices",
    {
      onRequest: requireSession,
      schema: { params: roomIdParamSchema, response: { 200: roomDevicesResponseSchema } },
    },
    async (request) => {
      const { roomId } = request.params;
      await requireActiveMembership(roomId, request.userId);
      const [roomRow] = await db.select().from(room).where(eq(room.id, roomId));
      if (!roomRow) {
        throw new NotFoundError("room not found");
      }
      const devices = await listActiveDevices(db, roomId, roomRow.currentEpoch);
      return {
        epoch: roomRow.currentEpoch,
        devices: devices.map((d) => ({ ...d, identityPublicKey: toBase64(d.identityPublicKey) })),
      };
    },
  );

  server.post(
    "/rooms/:roomId/removals",
    {
      onRequest: requireSession,
      schema: {
        params: roomIdParamSchema,
        body: removalSchema,
        response: { 200: rekeyResultSchema },
      },
    },
    async (request, reply) => {
      const { roomId } = request.params;
      const body = request.body;

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
        // No device.revokedAt here: it's a global column, and removedAt above already stops this room's envelopes.
        return runRekey(tx, {
          roomId,
          expectedEpoch: body.expectedEpoch,
          reason,
          nameCiphertext: fromBase64(body.nameCiphertext),
          envelopes: body.envelopes.map((envelope) => ({
            deviceId: envelope.deviceId,
            wrappedKey: fromBase64(envelope.wrappedKey),
          })),
          async mutateMembership(innerTx) {
            await innerTx
              .update(membership)
              .set({ removedAt: new Date() })
              .where(eq(membership.id, target.id));
          },
        });
      });

      return reply.status(200).send(result);
    },
  );
}
