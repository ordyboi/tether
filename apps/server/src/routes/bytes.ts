export function toBase64(bytes: Buffer) {
  return bytes.toString("base64");
}

export function fromBase64(value: string) {
  return Buffer.from(value, "base64");
}
