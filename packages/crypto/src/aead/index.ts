export type { Aead } from "./types.js";
export { aesGcm } from "./aes-gcm.js";
export { chacha20Poly1305 } from "./chacha20-poly1305.js";

import { aesGcm } from "./aes-gcm.js";

export const defaultAead = aesGcm;
