import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";

import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";
import { envelopeRoutes } from "./routes/envelopes.js";
import { healthRoutes } from "./routes/health.js";
import { inviteRoutes } from "./routes/invites.js";
import { roomRoutes } from "./routes/rooms.js";

export function buildApp(options: { loggerStream?: NodeJS.WritableStream } = {}) {
  const app = Fastify({
    logger: {
      stream: options.loggerStream,
      serializers: {
        req(request) {
          return { method: request.method, url: request.url };
        },
        res(reply) {
          return { statusCode: reply.statusCode };
        },
      },
    },
    disableRequestLogging: true,
    trustProxy: false,
  });

  app.register(cors, { origin: env.TRUSTED_ORIGINS });
  app.decorateRequest("userId", "");

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "invalid request body", issues: error.issues });
    }
    // Never let a driver/framework error's message reach the client — it can carry SQL, column
    // names or bound parameters (including caller identifiers). Route-level HttpErrors are
    // already sent by sendHttpError before reaching here; anything landing here is unexpected.
    request.log.error(error);
    return reply.status(500).send({ error: "internal server error" });
  });

  app.register(authRoutes);
  app.register(healthRoutes);
  app.register(deviceRoutes);
  app.register(roomRoutes);
  app.register(envelopeRoutes);
  app.register(inviteRoutes);

  return app;
}
