import type { z } from "zod";

import type {
  deviceCreateSchema,
  envelopeQuerySchema,
  inviteCreateSchema,
  inviteLookupSchema,
  inviteRedeemSchema,
  removalSchema,
  roomCreateSchema,
} from "./schemas.js";
import type {
  deviceResponseSchema,
  envelopeListResponseSchema,
  inviteLookupResponseSchema,
  inviteResponseSchema,
  redeemResponseSchema,
  rekeyResultSchema,
  roomDevicesResponseSchema,
  roomListResponseSchema,
  roomSummarySchema,
} from "./responses.js";

export type DeviceCreate = z.infer<typeof deviceCreateSchema>;
export type RoomCreate = z.infer<typeof roomCreateSchema>;
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
