import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

const requiredEnv = {
  DATABASE_URL: "postgres://tether:tether@localhost:5432/tether",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  TRUSTED_ORIGINS: " http://localhost:3000 , ,http://localhost:19006 ",
  PASSKEY_RP_ID: "localhost",
  PASSKEY_RP_NAME: "Tether",
  PASSKEY_ORIGIN: "http://localhost:3000",
};

describe("loadEnv", () => {
  it("splits TRUSTED_ORIGINS into a trimmed, blank-filtered list", () => {
    const env = loadEnv(requiredEnv);
    expect(env.TRUSTED_ORIGINS).toEqual(["http://localhost:3000", "http://localhost:19006"]);
  });

  it("accepts Google and Apple credentials left entirely blank", () => {
    expect(() => loadEnv(requiredEnv)).not.toThrow();
  });

  it("rejects a Google client id with no matching secret", () => {
    expect(() => loadEnv({ ...requiredEnv, GOOGLE_CLIENT_ID: "some-client-id" })).toThrow();
  });

  it("rejects an Apple credential group missing the bundle identifier", () => {
    expect(() =>
      loadEnv({
        ...requiredEnv,
        APPLE_CLIENT_ID: "some-client-id",
        APPLE_CLIENT_SECRET: "some-secret",
      }),
    ).toThrow();
  });

  it("accepts a fully-populated Google credential pair", () => {
    expect(() =>
      loadEnv({
        ...requiredEnv,
        GOOGLE_CLIENT_ID: "some-client-id",
        GOOGLE_CLIENT_SECRET: "some-secret",
      }),
    ).not.toThrow();
  });
});
