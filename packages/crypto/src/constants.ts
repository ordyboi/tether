import { aesGcm, chacha20Poly1305 } from "./aead/noble-aead.js";
import type { Aead } from "./aead/types.js";

export const AEADS: ReadonlyArray<[string, Aead]> = [
  ["aesGcm", aesGcm],
  ["chacha20Poly1305", chacha20Poly1305],
];
