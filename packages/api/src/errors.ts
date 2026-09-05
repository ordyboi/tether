import { z } from "zod";

export const ERROR_CODES = [
  "invalid_request",
  "wrap_set_mismatch",
  "unauthorized",
  "forbidden",
  "not_found",
  "stale_epoch",
  "room_exists",
  "invite_exists",
  "already_member",
  "device_already_registered",
  "internal",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorResponseSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
