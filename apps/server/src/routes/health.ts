import { healthResponseSchema } from "@tether/api";
import type { FastifyInstance } from "fastify";

import type { ZodTypeProvider } from "../zod-type-provider.js";

export function healthRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get("/health", { schema: { response: { 200: healthResponseSchema } } }, async () => {
    return { status: "ok" as const };
  });
}
