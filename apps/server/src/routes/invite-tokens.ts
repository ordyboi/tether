import { createHash } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { invite } from "../db/schema/membership.js";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Every lookup, redemption and pre-membership device lookup must pass the same
// "unexpired, unredeemed, unrevoked" condition.
export function liveInviteWhere(tokenHash: string, now: Date) {
  return and(
    eq(invite.tokenHash, tokenHash),
    gt(invite.expiresAt, now),
    isNull(invite.redeemedAt),
    isNull(invite.revokedAt),
  );
}
