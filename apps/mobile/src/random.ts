import { bytesToHex, type RandomSource } from "@tether/crypto";
import * as Crypto from "expo-crypto";

export const random: RandomSource = (byteLength) => Crypto.getRandomBytes(byteLength);

// expo-crypto's randomUUID() has no dev/test fallback (unlike getRandomBytes), so build
// the UUID ourselves from bytes that are already proven to work everywhere.
export function randomUUID() {
  const bytes = random(16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
