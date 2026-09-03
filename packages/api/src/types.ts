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
