import { aesGcm } from "../aead/aes-gcm.js";
import { chacha20Poly1305 } from "../aead/chacha20-poly1305.js";
import type { Aead } from "../aead/types.js";

export const AEADS: ReadonlyArray<[string, Aead]> = [
  ["aesGcm", aesGcm],
  ["chacha20Poly1305", chacha20Poly1305],
];
