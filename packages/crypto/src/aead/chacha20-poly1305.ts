import { chacha20poly1305 } from "@noble/ciphers/chacha.js";

import { concatBytes } from "../bytes.js";
import type { Aead } from "./types.js";

const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

export const chacha20Poly1305: Aead = {
  keyLength: KEY_LENGTH,
  nonceLength: NONCE_LENGTH,
  tagLength: TAG_LENGTH,
  async seal(key, plaintext, aad, random) {
    const nonce = random(NONCE_LENGTH);
    const body = chacha20poly1305(key, nonce, aad).encrypt(plaintext);
    return concatBytes(nonce, body);
  },
  async open(key, sealed, aad) {
    const nonce = sealed.subarray(0, NONCE_LENGTH);
    const body = sealed.subarray(NONCE_LENGTH);
    return chacha20poly1305(key, nonce, aad).decrypt(body);
  },
};
