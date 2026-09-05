import { decodeBase64, decodeBase64Url, encodeBase64, encodeBase64Url } from "./base64";

describe("base64", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 254, 255, 128, 64, 16]);
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
  });

  it("matches Buffer's base64 encoding", () => {
    const bytes = Uint8Array.from(Buffer.from("hello, tether", "utf8"));
    expect(encodeBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles lengths not divisible by three", () => {
    for (const length of [0, 1, 2, 3, 4, 5]) {
      const bytes = Uint8Array.from({ length }, (_, index) => index * 7);
      expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
    }
  });
});

describe("base64url", () => {
  it("round-trips and has no padding or +/ characters", () => {
    for (const length of [0, 1, 16, 31, 32]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 37) % 256);
      const encoded = encodeBase64Url(bytes);
      expect(encoded).not.toMatch(/[+/=]/);
      expect(decodeBase64Url(encoded)).toEqual(bytes);
    }
  });
});
