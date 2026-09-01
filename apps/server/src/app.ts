import cors from "@fastify/cors";
import Fastify from "fastify";

import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";

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

  app.register(authRoutes);
  app.register(healthRoutes);

  return app;
}
