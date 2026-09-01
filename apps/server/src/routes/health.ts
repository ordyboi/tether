import type { FastifyInstance } from "fastify";

export function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok" };
  });
}
