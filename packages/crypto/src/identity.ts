import { x25519 } from "@noble/curves/ed25519.js";

import type { RandomSource } from "./random.js";

export interface IdentityKeyPair {
  readonly secretKey: Uint8Array;
  readonly publicKey: Uint8Array;
}

export function generateIdentityKeyPair(random: RandomSource): IdentityKeyPair {
  const secretKey = random(32);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

export function scalarMult(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(secretKey, publicKey);
}
