const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeBase64(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const byte0 = bytes[index]!;
    const byte1 = bytes[index + 1];
    const byte2 = bytes[index + 2];

    output += CHARS[byte0 >> 2]!;
    output += CHARS[((byte0 & 0b11) << 4) | (byte1 === undefined ? 0 : byte1 >> 4)]!;
    output +=
      byte1 === undefined
        ? "="
        : CHARS[((byte1 & 0b1111) << 2) | (byte2 === undefined ? 0 : byte2 >> 6)]!;
    output += byte2 === undefined ? "=" : CHARS[byte2 & 0b111111]!;
  }
  return output;
}

export function decodeBase64(value: string) {
  const clean = value.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of clean) {
    const charValue = CHARS.indexOf(char);
    buffer = (buffer << 6) | charValue;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes[byteIndex] = (buffer >> bitsCollected) & 0xff;
      byteIndex += 1;
    }
  }
  return bytes;
}

export function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(value: string) {
  const restored = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = restored + "=".repeat((4 - (restored.length % 4)) % 4);
  return decodeBase64(padded);
}
