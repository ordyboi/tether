import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { base64ByteLength, ciphertextBase64, identityPublicKeyBase64 } from "./base64.js";
import { MAX_CIPHERTEXT_BYTES } from "./constants.js";

describe("base64ByteLength", () => {
  it.each([0, 1, 2, 16, 32, 48, 100])("matches Buffer.from(...).length for %i bytes", (length) => {
    const value = randomBytes(length).toString("base64");
    expect(base64ByteLength(value)).toBe(Buffer.from(value, "base64").length);
  });
});

describe("ciphertextBase64", () => {
  it("accepts a non-empty ciphertext within the max size", () => {
    const value = randomBytes(32).toString("base64");
    expect(ciphertextBase64.safeParse(value).success).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(ciphertextBase64.safeParse("").success).toBe(false);
  });

  it("rejects a ciphertext over MAX_CIPHERTEXT_BYTES", () => {
    const value = randomBytes(MAX_CIPHERTEXT_BYTES + 1).toString("base64");
    expect(ciphertextBase64.safeParse(value).success).toBe(false);
  });
});

describe("identityPublicKeyBase64", () => {
  it("accepts exactly 32 bytes", () => {
    const value = randomBytes(32).toString("base64");
    expect(identityPublicKeyBase64.safeParse(value).success).toBe(true);
  });

  it("rejects a key that is not exactly 32 bytes", () => {
    const value = randomBytes(31).toString("base64");
    expect(identityPublicKeyBase64.safeParse(value).success).toBe(false);
  });
});
