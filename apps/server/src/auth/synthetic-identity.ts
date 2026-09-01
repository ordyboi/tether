import { randomUUID } from "node:crypto";

export const SYNTHETIC_NAME = "tether user";
const SYNTHETIC_EMAIL_DOMAIN = "stripped.tether.invalid";

export function syntheticEmail(): string {
  return `${randomUUID()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
