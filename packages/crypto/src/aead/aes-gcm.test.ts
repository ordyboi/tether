import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, utf8ToBytes } from "../bytes.js";
import type { RandomSource } from "../random.js";
import { aesGcm } from "./noble-aead.js";

// Phase 0b's known-answer vector asserts exact ciphertext bytes, which only
// AES-256-GCM can reproduce — this is not part of the parameterized suite.
describe("aesGcm known-answer test (Phase 0b)", () => {
  const keyHex = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const nonceHex = "101112131415161718191a1b";
  const plaintextUtf8 =
    "Tether Phase 0b fixed 300-byte payload. Tether Phase 0b fixed 300-byte payload. Tether Phase 0b fixed 300-byte payload. Tether Phase 0b fixed 300-byte payload. Tether Phase 0b fixed 300-byte payload. Tether Phase 0b fixed 300-byte payload. Tether Phase 0b fixed 300-byte payload. Tether Phase 0b fixe";
  const expectedCiphertextHex =
    "299bec7e2cbb1ae3a2147b782f490b73b139366b7fe26481d7d4801e2a3174ab31903b6c94c240cf2a53e639efea334b7bdd3416c3bb3bd2da77425497b7975b35d55d5a3ddb2b440cf95991b9a5c69e69dce6c503ef726ae891537aceb481351a6e36d3d68a48a15e24b30a1818f2e234b3844989dbd7dfe29baf8b1ac0d84bf5a2b74356d2a3c311defeb6d8e9774f9f0e0a2422bceb90cfad26e2ed91c30b90b2fb25eb8ab1f1931362deb10803628f02cec68f008754ce8ed46387f0cb3b5fa531209a93b1d2e667cd4e37602bcbe0c57c3d579e2c840c61a09116e5cae699c23245380b911f47588ccd2fffd5142a8bc18368356090807c84ba3125a3f6531a518cdb14107a78df2983734484969821ef1872e90db3b0ed184e2999bac47a30a6a55fde9cd3d8fb25d3";
  const expectedTagHex = "530390eda7a03a52be48a97f86d6affd";

  const fixedNonce: RandomSource = () => hexToBytes(nonceHex);

  it("reproduces the exact sealed bytes from the Phase 0b vector", async () => {
    const key = hexToBytes(keyHex);
    const plaintext = utf8ToBytes(plaintextUtf8);

    const sealed = await aesGcm.seal(key, plaintext, new Uint8Array(0), fixedNonce);

    expect(bytesToHex(sealed)).toBe(`${nonceHex}${expectedCiphertextHex}${expectedTagHex}`);
  });

  it("opens back to the original plaintext", async () => {
    const key = hexToBytes(keyHex);
    const sealed = hexToBytes(`${nonceHex}${expectedCiphertextHex}${expectedTagHex}`);

    const opened = await aesGcm.open(key, sealed, new Uint8Array(0));

    expect(opened).toEqual(utf8ToBytes(plaintextUtf8));
  });
});
