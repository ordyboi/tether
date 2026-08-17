import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error.ts";

export function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.error({ err: error }, "validation error");
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: error.message,
        details: error.issues,
      });
    }

    if (error instanceof AppError) {
      request.log.error({ err: error }, error.message);
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    request.log.error({ err: error }, "unhandled error");
    return reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  });
}