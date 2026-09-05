import type { ErrorCode } from "@tether/api";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(401, "unauthorized", message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, "not_found", message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, "forbidden", message);
  }
}

export class StaleEpochError extends HttpError {
  constructor(expectedEpoch: number, currentEpoch: number) {
    super(409, "stale_epoch", "expectedEpoch does not match room.currentEpoch", {
      expectedEpoch,
      currentEpoch,
    });
  }
}

export class WrapSetMismatchError extends HttpError {
  constructor(missing: string[], extra: string[], duplicate: string[] = []) {
    super(400, "wrap_set_mismatch", "envelope device set does not match the required wrap set", {
      missing,
      extra,
      duplicate,
    });
  }
}

export class RoomExistsError extends HttpError {
  constructor() {
    super(409, "room_exists", "roomId already exists");
  }
}

export class InviteExistsError extends HttpError {
  constructor() {
    super(409, "invite_exists", "invite id already exists");
  }
}

export class AlreadyMemberError extends HttpError {
  constructor() {
    super(409, "already_member", "already an active member of this room");
  }
}

export class DeviceAlreadyRegisteredError extends HttpError {
  constructor() {
    super(409, "device_already_registered", "identityPublicKey already registered to another user");
  }
}
