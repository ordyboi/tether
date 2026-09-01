import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "./bytes.js";
import { generateIdentityKeyPair, scalarMult } from "./identity.js";
import type { RandomSource } from "./random.js";
import vectors from "../vectors/phase0b.json" with { type: "json" };

describe("scalarMult", () => {
  it("matches RFC 7748 §5.2 test vector 1", () => {
    const { scalarHex, uCoordinateHex, expectedOutputHex } = vectors.x25519;

    const output = scalarMult(hexToBytes(scalarHex), hexToBytes(uCoordinateHex));

    expect(bytesToHex(output)).toBe(expectedOutputHex);
  });
});

describe("generateIdentityKeyPair", () => {
  it("derives a public key consistent with the generated secret key", () => {
    const fixedSecret: RandomSource = () => hexToBytes(vectors.x25519.scalarHex);

    const keyPair = generateIdentityKeyPair(fixedSecret);
    const otherKeyPair = generateIdentityKeyPair(() => hexToBytes("0".repeat(62) + "02"));

    const sharedFromA = scalarMult(keyPair.secretKey, otherKeyPair.publicKey);
    const sharedFromB = scalarMult(otherKeyPair.secretKey, keyPair.publicKey);

    expect(bytesToHex(sharedFromA)).toBe(bytesToHex(sharedFromB));
  });
});
