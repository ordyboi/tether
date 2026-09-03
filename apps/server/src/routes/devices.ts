import { deviceCreateSchema, deviceResponseSchema } from "@tether/api";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { DeviceAlreadyRegisteredError } from "../errors.js";
import type { ZodTypeProvider } from "../zod-type-provider.js";
import { fromBase64, toBase64 } from "./bytes.js";

function serializeDevice(row: typeof device.$inferSelect) {
  return {
    id: row.id,
    identityPublicKey: toBase64(row.identityPublicKey),
    platform: row.platform,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export function deviceRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    "/devices",
    {
      onRequest: requireSession,
      schema: {
        body: deviceCreateSchema,
        response: { 200: deviceResponseSchema, 201: deviceResponseSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const identityPublicKey = fromBase64(body.identityPublicKey);

      const [existing] = await db
        .select()
        .from(device)
        .where(eq(device.identityPublicKey, identityPublicKey));

      if (existing?.userId && existing.userId !== request.userId) {
        throw new DeviceAlreadyRegisteredError();
      }
      if (existing) {
        return reply.status(200).send(serializeDevice(existing));
      }

      const [created] = await db
        .insert(device)
        .values({
          userId: request.userId,
          identityPublicKey,
          platform: body.platform,
          pushToken: body.pushToken,
        })
        .returning();
      if (!created) {
        throw new Error("device insert returned no row");
      }

      return reply.status(201).send(serializeDevice(created));
    },
  );
}
