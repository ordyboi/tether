import { z } from "zod";

import { ciphertextBase64, identityPublicKeyBase64 } from "./base64.js";
import { INVITE_MAX_TTL_DAYS } from "./constants.js";

const TOKEN_HASH_HEX_LENGTH = 64; // SHA-256 hex digest
const INVITE_MAX_TTL_MS = INVITE_MAX_TTL_DAYS * 24 * 60 * 60 * 1000;

export const roomIdParamSchema = z.object({ roomId: z.uuid() });

export const envelopeSchema = z.object({
  deviceId: z.uuid(),
  wrappedKey: ciphertextBase64,
});

export const rekeyPayloadSchema = z.object({
  expectedEpoch: z.number().int().nonnegative(),
  nameCiphertext: ciphertextBase64,
  envelopes: z.array(envelopeSchema).min(1),
});

export const deviceCreateSchema = z.object({
  identityPublicKey: identityPublicKeyBase64,
  platform: z.enum(["ios", "android"]),
  pushToken: z.string().min(1).optional(),
});

export const roomCreateSchema = z.object({
  // client-generated: the epoch-0 self-wrap binds roomId before the row exists server-side.
  roomId: z.uuid().optional(),
  nameCiphertext: ciphertextBase64,
  precisionPolicy: z.enum(["approximate_only", "on_request", "always_precise"]),
  approximateRadiusM: z.number().int().positive().optional(),
  displayNameCiphertext: ciphertextBase64,
  envelopes: z.array(envelopeSchema).min(1),
});

export const inviteCreateSchema = z.object({
  tokenHash: z.string().regex(new RegExp(`^[0-9a-f]{${TOKEN_HASH_HEX_LENGTH}}$`)),
  grantsRole: z.enum(["admin", "member", "guest"]),
  wrappedRoomKey: ciphertextBase64,
  wrappedRoomKeyEpoch: z.number().int().nonnegative(),
  expiresAt: z.iso
    .datetime()
    .refine((value) => new Date(value).getTime() <= Date.now() + INVITE_MAX_TTL_MS, {
      message: `expiresAt may not be more than ${INVITE_MAX_TTL_DAYS} days from now`,
    }),
});

export const inviteLookupSchema = z.object({
  token: z.string().min(1),
});

export const inviteRedeemSchema = z.object({
  token: z.string().min(1),
  displayNameCiphertext: ciphertextBase64,
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
