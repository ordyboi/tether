import { gcm } from "@noble/ciphers/aes.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";

import { concatBytes } from "../bytes.js";
import type { Aead } from "./types.js";

const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;

type NobleAeadCipher = (
  key: Uint8Array,
  nonce: Uint8Array,
  aad?: Uint8Array,
) => { encrypt(plaintext: Uint8Array): Uint8Array; decrypt(sealed: Uint8Array): Uint8Array };

function createNobleAead(cipher: NobleAeadCipher): Aead {
  return {
    keyLength: KEY_LENGTH,
    async seal(key, plaintext, aad, random) {
      const nonce = random(NONCE_LENGTH);
      const body = cipher(key, nonce, aad).encrypt(plaintext);
      return concatBytes(nonce, body);
    },
    async open(key, sealed, aad) {
      if (sealed.length < NONCE_LENGTH) {
        throw new Error("sealed input is truncated");
      }
      const nonce = sealed.subarray(0, NONCE_LENGTH);
      const body = sealed.subarray(NONCE_LENGTH);
      return cipher(key, nonce, aad).decrypt(body);
    },
  };
}

export const aesGcm = createNobleAead(gcm);
export const chacha20Poly1305 = createNobleAead(chacha20poly1305);
