import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "./bytes.js";
import { hkdfSha256 } from "./kdf.js";

describe("hkdfSha256", () => {
  it("matches RFC 5869 Appendix A.1 Test Case 1", () => {
    const ikm = hexToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
    const salt = hexToBytes("000102030405060708090a0b0c");
    const info = hexToBytes("f0f1f2f3f4f5f6f7f8f9");
    const expectedOkmHex =
      "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865";

    const okm = hkdfSha256(ikm, salt, info, 42);

    expect(bytesToHex(okm)).toBe(expectedOkmHex);
  });
});
