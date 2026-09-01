import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, utf8ToBytes } from "../bytes.js";
import type { RandomSource } from "../random.js";
import { aesGcm } from "./aes-gcm.js";
import vectors from "../../vectors/phase0b.json" with { type: "json" };

// Phase 0b's known-answer vector asserts exact ciphertext bytes, which only
// AES-256-GCM can reproduce — this is not part of the parameterized suite.
describe("aesGcm known-answer test (Phase 0b)", () => {
  const { keyHex, nonceHex, plaintextUtf8, expectedCiphertextHex, expectedTagHex } = vectors.aesGcm;

  const fixedNonce: RandomSource = () => hexToBytes(nonceHex);

  it("reproduces the exact sealed bytes from the Phase 0b vector", async () => {
    const key = hexToBytes(keyHex);
    const plaintext = utf8ToBytes(plaintextUtf8);

    const sealed = await aesGcm.seal(key, plaintext, new Uint8Array(0), fixedNonce);

    const expectedSealed = nonceHex + expectedCiphertextHex + expectedTagHex;
    expect(bytesToHex(sealed)).toBe(expectedSealed);
  });

  it("opens back to the original plaintext", async () => {
    const key = hexToBytes(keyHex);
    const sealed = hexToBytes(nonceHex + expectedCiphertextHex + expectedTagHex);

    const opened = await aesGcm.open(key, sealed, new Uint8Array(0));

    expect(opened).toEqual(utf8ToBytes(plaintextUtf8));
  });
});
