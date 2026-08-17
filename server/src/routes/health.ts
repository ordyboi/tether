import type { FastifyInstance } from "fastify";
import { AppError } from "../utils/app-error.ts";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async (request, reply) => {
    try {
      await app.db.execute("select 1");
      return reply.code(200).send({ status: "ok" });
    } catch (err) {
      request.log.error({ err }, "health check failed");
      throw new AppError(503, "DB_UNREACHABLE", "Database unreachable");
    }
  });
}