export type RandomSource = (byteLength: number) => Uint8Array;

export const defaultRandomSource: RandomSource = (byteLength) => {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};
