import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "./bytes.js";
import { generateIdentityKeyPair, scalarMult } from "./identity.js";
import type { RandomSource } from "./random.js";

const RFC7748_SCALAR_HEX = "a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4";
const RFC7748_U_COORDINATE_HEX = "e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c";
const RFC7748_EXPECTED_OUTPUT_HEX =
  "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552";

describe("scalarMult", () => {
  it("matches RFC 7748 §5.2 test vector 1", () => {
    const output = scalarMult(hexToBytes(RFC7748_SCALAR_HEX), hexToBytes(RFC7748_U_COORDINATE_HEX));

    expect(bytesToHex(output)).toBe(RFC7748_EXPECTED_OUTPUT_HEX);
  });
});

describe("generateIdentityKeyPair", () => {
  it("derives a public key consistent with the generated secret key", () => {
    const fixedSecret: RandomSource = () => hexToBytes(RFC7748_SCALAR_HEX);

    const keyPair = generateIdentityKeyPair(fixedSecret);
    const otherKeyPair = generateIdentityKeyPair(() => hexToBytes("0".repeat(62) + "02"));

    const sharedFromA = scalarMult(keyPair.secretKey, otherKeyPair.publicKey);
    const sharedFromB = scalarMult(otherKeyPair.secretKey, keyPair.publicKey);

    expect(bytesToHex(sharedFromA)).toBe(bytesToHex(sharedFromB));
  });
});
