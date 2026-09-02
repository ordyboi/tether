import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { membership } from "../db/schema/membership.js";
import { roomKeyEnvelope } from "../db/schema/rooms.js";
import { NotFoundError, sendHttpError } from "../rooms/errors.js";
import { envelopeQuerySchema } from "./schemas.js";

export function envelopeRoutes(app: FastifyInstance) {
  app.get("/envelopes", { preHandler: requireSession }, async (request, reply) => {
    const query = envelopeQuerySchema.parse(request.query);

    try {
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

      return { envelopes };
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });
}
