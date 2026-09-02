import type { FastifyReply } from "fastify";

export class HttpError extends Error {
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, message, details);
  }
}

export class StaleEpochError extends HttpError {
  constructor(expectedEpoch: number, currentEpoch: number) {
    super(409, "expectedEpoch does not match room.currentEpoch", { expectedEpoch, currentEpoch });
  }
}

export class WrapSetMismatchError extends HttpError {
  constructor(missing: string[], extra: string[]) {
    super(400, "envelope device set does not match the required wrap set", { missing, extra });
  }
}

export function sendHttpError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    return reply.status(error.status).send({ error: error.message, ...error.details });
  }
  throw error;
}
