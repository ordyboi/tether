import type { RandomSource } from "../random.js";

export interface Aead {
  readonly keyLength: number;
  // Returns nonce || ciphertext || tag; draws its own nonce from `random`.
  seal(
    key: Uint8Array,
    plaintext: Uint8Array,
    aad: Uint8Array,
    random: RandomSource,
  ): Promise<Uint8Array>;
  open(key: Uint8Array, sealed: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
}
