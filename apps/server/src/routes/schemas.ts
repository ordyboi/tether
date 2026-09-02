import { z } from "zod";

import { INVITE_MAX_TTL_DAYS, MAX_CIPHERTEXT_BYTES } from "../constants.js";

const IDENTITY_PUBLIC_KEY_BYTES = 32; // X25519 public key
const TOKEN_HASH_HEX_LENGTH = 64; // SHA-256 hex digest
const INVITE_MAX_TTL_MS = INVITE_MAX_TTL_DAYS * 24 * 60 * 60 * 1000;

export const base64Bytes = z.base64().transform((value) => Buffer.from(value, "base64"));

export function toBase64(bytes: Buffer) {
  return bytes.toString("base64");
}

export const ciphertextBytes = base64Bytes.refine(
  (bytes) => bytes.length > 0 && bytes.length <= MAX_CIPHERTEXT_BYTES,
  { message: `must be 1-${MAX_CIPHERTEXT_BYTES} bytes` },
);

export const identityPublicKeyBytes = base64Bytes.refine(
  (bytes) => bytes.length === IDENTITY_PUBLIC_KEY_BYTES,
  { message: `identityPublicKey must be exactly ${IDENTITY_PUBLIC_KEY_BYTES} bytes` },
);

export const roomIdParamSchema = z.object({ roomId: z.uuid() });

export const envelopeSchema = z.object({
  deviceId: z.uuid(),
  wrappedKey: ciphertextBytes,
});

export const rekeyPayloadSchema = z.object({
  expectedEpoch: z.number().int().nonnegative(),
  nameCiphertext: ciphertextBytes,
  envelopes: z.array(envelopeSchema).min(1),
});

export const deviceCreateSchema = z.object({
  identityPublicKey: identityPublicKeyBytes,
  platform: z.enum(["ios", "android"]),
  pushToken: z.string().min(1).optional(),
});

export const roomCreateSchema = z.object({
  // client-generated: the epoch-0 self-wrap binds roomId before the row exists server-side.
  roomId: z.uuid().optional(),
  nameCiphertext: ciphertextBytes,
  precisionPolicy: z.enum(["approximate_only", "on_request", "always_precise"]),
  approximateRadiusM: z.number().int().positive().optional(),
  displayNameCiphertext: ciphertextBytes,
  envelopes: z.array(envelopeSchema).min(1),
});

export const inviteCreateSchema = z.object({
  tokenHash: z.string().regex(new RegExp(`^[0-9a-f]{${TOKEN_HASH_HEX_LENGTH}}$`)),
  grantsRole: z.enum(["admin", "member", "guest"]),
  wrappedRoomKey: ciphertextBytes,
  wrappedRoomKeyEpoch: z.number().int().nonnegative(),
  expiresAt: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .refine((date) => date.getTime() <= Date.now() + INVITE_MAX_TTL_MS, {
      message: `expiresAt may not be more than ${INVITE_MAX_TTL_DAYS} days from now`,
    }),
});

export const inviteLookupSchema = z.object({
  token: z.string().min(1),
});

export const inviteRedeemSchema = z.object({
  token: z.string().min(1),
  displayNameCiphertext: ciphertextBytes,
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
