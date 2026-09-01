const PADDED_BLOCK_LENGTH = 256;
const LENGTH_PREFIX_BYTES = 2;
export const MAX_FIX_PAYLOAD_LENGTH = PADDED_BLOCK_LENGTH - LENGTH_PREFIX_BYTES;

export function padFixPlaintext(payload: Uint8Array) {
  if (payload.length > MAX_FIX_PAYLOAD_LENGTH) {
    throw new Error(`payload exceeds max length of ${MAX_FIX_PAYLOAD_LENGTH} bytes`);
  }
  const out = new Uint8Array(PADDED_BLOCK_LENGTH);
  new DataView(out.buffer).setUint16(0, payload.length, false);
  out.set(payload, LENGTH_PREFIX_BYTES);
  return out;
}

export function unpadFixPlaintext(padded: Uint8Array) {
  if (padded.length !== PADDED_BLOCK_LENGTH) {
    throw new Error(`padded plaintext must be exactly ${PADDED_BLOCK_LENGTH} bytes`);
  }
  const length = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint16(
    0,
    false,
  );
  if (length > MAX_FIX_PAYLOAD_LENGTH) {
    throw new Error("corrupt padding: encoded length exceeds max payload length");
  }
  return padded.slice(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + length);
}
