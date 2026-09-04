import { envelopeListResponseSchema, envelopeQuerySchema } from "@tether/api";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { membership } from "../db/schema/membership.js";
import { roomKeyEnvelope } from "../db/schema/rooms.js";
import { NotFoundError } from "../errors.js";
import type { ZodTypeProvider } from "../zod-type-provider.js";
import { toBase64 } from "./bytes.js";

export function envelopeRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    "/envelopes",
    {
      onRequest: requireSession,
      schema: { querystring: envelopeQuerySchema, response: { 200: envelopeListResponseSchema } },
    },
    async (request) => {
      const query = request.query;

      const [deviceRow] = await db.select().from(device).where(eq(device.id, query.deviceId));
      if (!deviceRow || deviceRow.userId !== request.userId) {
        throw new NotFoundError("device not found");
      }
      if (deviceRow.revokedAt) {
        return { envelopes: [] };
      }

      const conditions = [
        eq(roomKeyEnvelope.deviceId, query.deviceId),
        eq(membership.userId, deviceRow.userId),
        isNull(membership.removedAt),
        lte(membership.joinedEpoch, roomKeyEnvelope.epoch),
      ];
      if (query.roomId !== undefined) {
        conditions.push(eq(roomKeyEnvelope.roomId, query.roomId));
      }
      if (query.sinceEpoch !== undefined) {
        conditions.push(gte(roomKeyEnvelope.epoch, query.sinceEpoch));
      }

      const envelopes = await db
        .select({
          roomId: roomKeyEnvelope.roomId,
          epoch: roomKeyEnvelope.epoch,
          wrappedKey: roomKeyEnvelope.wrappedKey,
        })
        .from(roomKeyEnvelope)
        .innerJoin(membership, eq(membership.roomId, roomKeyEnvelope.roomId))
        .where(and(...conditions));

      return {
        envelopes: envelopes.map((envelope) => ({
          ...envelope,
          wrappedKey: toBase64(envelope.wrappedKey),
        })),
      };
    },
  );
}
