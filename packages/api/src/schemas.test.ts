import { randomBytes, randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { INVITE_MAX_TTL_DAYS } from "./constants.js";
import { envelopeQuerySchema, inviteCreateSchema } from "./schemas.js";

function baseInvite(expiresAt: string) {
  return {
    tokenHash: "a".repeat(64),
    grantsRole: "member" as const,
    wrappedRoomKey: randomBytes(48).toString("base64"),
    wrappedRoomKeyEpoch: 0,
    expiresAt,
  };
}

describe("inviteCreateSchema.expiresAt", () => {
  it("accepts an expiresAt within the max TTL", () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    expect(inviteCreateSchema.safeParse(baseInvite(soon)).success).toBe(true);
  });

  it("rejects an expiresAt beyond the max TTL", () => {
    const tooFar = new Date(
      Date.now() + (INVITE_MAX_TTL_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(inviteCreateSchema.safeParse(baseInvite(tooFar)).success).toBe(false);
  });

  it("rejects a non-ISO-8601 expiresAt", () => {
    expect(inviteCreateSchema.safeParse(baseInvite("not-a-date")).success).toBe(false);
  });
});

describe("envelopeQuerySchema.sinceEpoch", () => {
  it("coerces a numeric query-string value to a number", () => {
    const result = envelopeQuerySchema.safeParse({ deviceId: randomUUID(), sinceEpoch: "3" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.sinceEpoch).toBe(3);
  });

  it("rejects a negative sinceEpoch", () => {
    const result = envelopeQuerySchema.safeParse({ deviceId: randomUUID(), sinceEpoch: "-1" });
    expect(result.success).toBe(false);
  });

  it("leaves sinceEpoch undefined when omitted", () => {
    const result = envelopeQuerySchema.safeParse({ deviceId: randomUUID() });
    expect(result.success).toBe(true);
    expect(result.success && result.data.sinceEpoch).toBeUndefined();
  });
});
