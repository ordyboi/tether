import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, utf8ToBytes } from "../bytes.js";
import type { RandomSource } from "../random.js";
import { chacha20Poly1305 } from "./noble-aead.js";

// RFC 8439 §2.8.2, "Example and Test Vector for AEAD_CHACHA20_POLY1305".
// This is chacha20Poly1305's own known-answer test, standalone like the AES one.
describe("chacha20Poly1305 known-answer test (RFC 8439 §2.8.2)", () => {
  const plaintext = utf8ToBytes(
    "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
  );
  const aad = hexToBytes("50515253c0c1c2c3c4c5c6c7");
  const key = hexToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
  const nonce = hexToBytes("070000004041424344454647");
  const expectedCiphertextHex =
    "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d" +
    "63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b" +
    "3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d" +
    "7bc3ff4def08e4b7a9de576d26586cec64b6116";
  const expectedTagHex = "1ae10b594f09e26a7e902ecbd0600691";

  const fixedNonce: RandomSource = () => nonce;

  it("reproduces the exact sealed bytes from the RFC vector", async () => {
    const sealed = await chacha20Poly1305.seal(key, plaintext, aad, fixedNonce);

    expect(bytesToHex(sealed)).toBe(bytesToHex(nonce) + expectedCiphertextHex + expectedTagHex);
  });

  it("opens back to the original plaintext", async () => {
    const sealed = hexToBytes(bytesToHex(nonce) + expectedCiphertextHex + expectedTagHex);

    const opened = await chacha20Poly1305.open(key, sealed, aad);

    expect(opened).toEqual(plaintext);
  });
});
