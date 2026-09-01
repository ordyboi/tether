import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "./bytes.js";
import { hkdfSha256 } from "./kdf.js";
import vectors from "../vectors/phase0b.json" with { type: "json" };

describe("hkdfSha256", () => {
  it("matches RFC 5869 Appendix A.1 Test Case 1", () => {
    const { ikmHex, saltHex, infoHex, length, expectedOkmHex } = vectors.hkdfSha256;

    const okm = hkdfSha256(hexToBytes(ikmHex), hexToBytes(saltHex), hexToBytes(infoHex), length);

    expect(bytesToHex(okm)).toBe(expectedOkmHex);
  });
});
