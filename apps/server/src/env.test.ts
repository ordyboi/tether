import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

const requiredEnv = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  TRUSTED_ORIGINS: "http://localhost:3000",
  PASSKEY_RP_ID: "localhost",
  PASSKEY_RP_NAME: "Tether",
  PASSKEY_ORIGIN: "http://localhost:3000",
};

const validEnv = {
  ...requiredEnv,
  DATABASE_URL: "postgres://tether:tether@localhost:5432/tether",
};

describe("loadEnv", () => {
  it("parses a valid environment", () => {
    expect(() => loadEnv(validEnv)).not.toThrow();
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => loadEnv(requiredEnv)).toThrow();
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
    expect(() => loadEnv({ ...validEnv, BETTER_AUTH_SECRET: "too-short" })).toThrow();
  });
});
