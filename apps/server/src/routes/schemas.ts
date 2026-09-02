import { z } from "zod";

export const base64Bytes = z.base64().transform((value) => Buffer.from(value, "base64"));

export const envelopeSchema = z.object({
  deviceId: z.uuid(),
  wrappedKey: base64Bytes,
});

export const rekeyPayloadSchema = z.object({
  expectedEpoch: z.number().int().nonnegative(),
  nameCiphertext: base64Bytes,
  envelopes: z.array(envelopeSchema).min(1),
});

export const deviceCreateSchema = z.object({
  identityPublicKey: base64Bytes,
  platform: z.enum(["ios", "android"]),
  pushToken: z.string().min(1).optional(),
});

export const roomCreateSchema = z.object({
  // client-generated: the creating device wraps room-key epoch 0 to itself before the room row
  // exists (the wrap's AAD binds roomId), so the id must be chosen client-side, not server-side.
  roomId: z.uuid().optional(),
  nameCiphertext: base64Bytes,
  precisionPolicy: z.enum(["approximate_only", "on_request", "always_precise"]),
  approximateRadiusM: z.number().int().positive().optional(),
  displayNameCiphertext: base64Bytes,
  envelopes: z.array(envelopeSchema).min(1),
});

export const inviteCreateSchema = z.object({
  tokenHash: z.string().min(1),
  grantsRole: z.enum(["admin", "member", "guest"]),
  wrappedRoomKey: base64Bytes,
  wrappedRoomKeyEpoch: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime().transform((value) => new Date(value)),
});

export const inviteLookupSchema = z.object({
  token: z.string().min(1),
});

export const inviteRedeemSchema = z.object({
  token: z.string().min(1),
  displayNameCiphertext: base64Bytes,
  deviceId: z.uuid(),
  ...rekeyPayloadSchema.shape,
});

export const envelopeQuerySchema = z.object({
  deviceId: z.uuid(),
  roomId: z.uuid().optional(),
  sinceEpoch: z.coerce.number().int().nonnegative().optional(),
});

export const removalSchema = z.object({
  alias: z.string().min(1),
  ...rekeyPayloadSchema.shape,
});
