import { z } from "zod";

import { ciphertextBase64, identityPublicKeyBase64 } from "./base64.js";

export const deviceResponseSchema = z.object({
  id: z.uuid(),
  identityPublicKey: identityPublicKeyBase64,
  platform: z.enum(["ios", "android"]),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.date(),
  revokedAt: z.iso.datetime().nullable(),
});

export const roomSummarySchema = z.object({
  roomId: z.uuid(),
  currentEpoch: z.number().int().nonnegative(),
  nameCiphertext: ciphertextBase64,
  nameEpoch: z.number().int().nonnegative(),
  precisionPolicy: z.enum(["approximate_only", "on_request", "always_precise"]),
  approximateRadiusM: z.number().int().positive(),
  memberAlias: z.string(),
  role: z.enum(["owner", "admin", "member", "guest"]),
  joinedEpoch: z.number().int().nonnegative(),
});

export const roomListResponseSchema = z.object({ rooms: z.array(roomSummarySchema) });

export const roomDevicesResponseSchema = z.object({
  epoch: z.number().int().nonnegative(),
  devices: z.array(z.object({ deviceId: z.uuid(), identityPublicKey: identityPublicKeyBase64 })),
});

export const rekeyResultSchema = z.object({ newEpoch: z.number().int().nonnegative() });

export const envelopeListResponseSchema = z.object({
  envelopes: z.array(
    z.object({
      roomId: z.uuid(),
      epoch: z.number().int().nonnegative(),
      wrappedKey: ciphertextBase64,
    }),
  ),
});

export const inviteResponseSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  grantsRole: z.enum(["admin", "member", "guest"]),
  wrappedRoomKey: ciphertextBase64,
  wrappedRoomKeyEpoch: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  redeemedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});

export const inviteLookupResponseSchema = z.object({
  roomId: z.uuid(),
  grantsRole: z.enum(["admin", "member", "guest"]),
  wrappedRoomKey: ciphertextBase64,
  wrappedRoomKeyEpoch: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime(),
});

export const redeemResponseSchema = z.object({
  newEpoch: z.number().int().nonnegative(),
  roomId: z.uuid(),
  memberAlias: z.string(),
});

export const healthResponseSchema = z.object({ status: z.literal("ok") });
