import { pgEnum } from "drizzle-orm/pg-core";

export const precisionPolicy = pgEnum("precision_policy", [
  "approximate_only",
  "on_request",
  "always_precise",
]);

export const epochReason = pgEnum("epoch_reason", [
  "created",
  "member_joined",
  "member_removed",
  "guest_joined",
  "guest_removed",
]);

export const membershipRole = pgEnum("membership_role", ["owner", "admin", "member", "guest"]);

export const requestStatus = pgEnum("request_status", [
  "pending",
  "approved",
  "denied",
  "cancelled",
]);

export const devicePlatform = pgEnum("device_platform", ["ios", "android"]);
