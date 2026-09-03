export class HttpError extends Error {
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(401, message);
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

export class StaleEpochError extends ConflictError {
  constructor(expectedEpoch: number, currentEpoch: number) {
    super("expectedEpoch does not match room.currentEpoch", { expectedEpoch, currentEpoch });
  }
}

export class WrapSetMismatchError extends HttpError {
  constructor(missing: string[], extra: string[], duplicate: string[] = []) {
    super(400, "envelope device set does not match the required wrap set", {
      missing,
      extra,
      duplicate,
    });
  }
}
