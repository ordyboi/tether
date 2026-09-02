import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSession } from "../auth/session.js";
import { db } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { deviceCreateSchema, toBase64 } from "./schemas.js";

function serializeDevice(row: typeof device.$inferSelect) {
  return { ...row, identityPublicKey: toBase64(row.identityPublicKey) };
}

export function deviceRoutes(app: FastifyInstance) {
  app.post("/devices", { preHandler: requireSession }, async (request, reply) => {
    const body = deviceCreateSchema.parse(request.body);

    const [existing] = await db
      .select()
      .from(device)
      .where(eq(device.identityPublicKey, body.identityPublicKey));

    if (existing) {
      if (existing.userId !== request.userId) {
        return reply
          .status(409)
          .send({ error: "identityPublicKey already registered to another user" });
      }
      return reply.status(200).send(serializeDevice(existing));
    }

    const [created] = await db
      .insert(device)
      .values({
        userId: request.userId,
        identityPublicKey: body.identityPublicKey,
        platform: body.platform,
        pushToken: body.pushToken,
      })
      .returning();
    if (!created) {
      throw new Error("device insert returned no row");
    }

    return reply.status(201).send(serializeDevice(created));
  });
}
