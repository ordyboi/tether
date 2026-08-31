import Fastify, { type FastifyInstance } from "fastify";

import { healthRoutes } from "./routes/health.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
  });

  app.register(healthRoutes);

  return app;
}
