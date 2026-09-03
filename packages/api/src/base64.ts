import { z } from "zod";

import { MAX_CIPHERTEXT_BYTES } from "./constants.js";

const IDENTITY_PUBLIC_KEY_BYTES = 32; // X25519 public key

export function base64ByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

export const ciphertextBase64 = z.base64().refine(
  (value) => {
    const bytes = base64ByteLength(value);
    return bytes > 0 && bytes <= MAX_CIPHERTEXT_BYTES;
  },
  { message: `must be 1-${MAX_CIPHERTEXT_BYTES} bytes` },
);

export const identityPublicKeyBase64 = z
  .base64()
  .refine((value) => base64ByteLength(value) === IDENTITY_PUBLIC_KEY_BYTES, {
    message: `identityPublicKey must be exactly ${IDENTITY_PUBLIC_KEY_BYTES} bytes`,
  });
