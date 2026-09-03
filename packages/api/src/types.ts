import type { z } from "zod";

import type {
  deviceCreateSchema,
  envelopeQuerySchema,
  envelopeSchema,
  inviteCreateSchema,
  inviteLookupSchema,
  inviteRedeemSchema,
  removalSchema,
  rekeyPayloadSchema,
  roomCreateSchema,
  roomIdParamSchema,
} from "./schemas.js";
import type { ErrorCode, errorResponseSchema } from "./errors.js";
import type {
  deviceResponseSchema,
  envelopeListResponseSchema,
  healthResponseSchema,
  inviteLookupResponseSchema,
  inviteResponseSchema,
  redeemResponseSchema,
  rekeyResultSchema,
  roomDevicesResponseSchema,
  roomListResponseSchema,
  roomSummarySchema,
} from "./responses.js";

export type Envelope = z.infer<typeof envelopeSchema>;
export type RekeyPayload = z.infer<typeof rekeyPayloadSchema>;
export type DeviceCreate = z.infer<typeof deviceCreateSchema>;
export type RoomCreate = z.infer<typeof roomCreateSchema>;
export type RoomIdParam = z.infer<typeof roomIdParamSchema>;
export type InviteCreate = z.infer<typeof inviteCreateSchema>;
export type InviteLookup = z.infer<typeof inviteLookupSchema>;
export type InviteRedeem = z.infer<typeof inviteRedeemSchema>;
export type EnvelopeQuery = z.infer<typeof envelopeQuerySchema>;
export type Removal = z.infer<typeof removalSchema>;

export type DeviceResponse = z.infer<typeof deviceResponseSchema>;
export type RoomSummary = z.infer<typeof roomSummarySchema>;
export type RoomListResponse = z.infer<typeof roomListResponseSchema>;
export type RoomDevicesResponse = z.infer<typeof roomDevicesResponseSchema>;
export type RekeyResult = z.infer<typeof rekeyResultSchema>;
export type EnvelopeListResponse = z.infer<typeof envelopeListResponseSchema>;
export type InviteResponse = z.infer<typeof inviteResponseSchema>;
export type InviteLookupResponse = z.infer<typeof inviteLookupResponseSchema>;
export type RedeemResponse = z.infer<typeof redeemResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type { ErrorCode };
