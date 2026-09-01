import { describe, expect, it } from "vitest";

import { MAX_FIX_PAYLOAD_LENGTH, padFixPlaintext, unpadFixPlaintext } from "./padding.js";

describe("padding", () => {
  it("pads to exactly 256 bytes and round-trips, at the length boundaries", () => {
    for (const length of [0, 1, MAX_FIX_PAYLOAD_LENGTH]) {
      const payload = new Uint8Array(length).map((_, i) => i);

      const padded = padFixPlaintext(payload);

      expect(padded.length).toBe(256);
      expect(unpadFixPlaintext(padded)).toEqual(payload);
    }
  });

  it("throws on overflow instead of truncating", () => {
    const tooLong = new Uint8Array(MAX_FIX_PAYLOAD_LENGTH + 1);

    expect(() => padFixPlaintext(tooLong)).toThrow();
  });

  it("throws when unpadding a buffer that is not exactly 256 bytes", () => {
    expect(() => unpadFixPlaintext(new Uint8Array(255))).toThrow();
    expect(() => unpadFixPlaintext(new Uint8Array(257))).toThrow();
  });

  it("throws when unpadding a buffer whose encoded length is corrupt", () => {
    const corrupt = new Uint8Array(256);
    corrupt[0] = 0xff;
    corrupt[1] = 0xff;

    expect(() => unpadFixPlaintext(corrupt)).toThrow();
  });
});
