import { randomUUID } from "node:crypto";

const SYNTHETIC_NAME = "tether user";
const SYNTHETIC_EMAIL_DOMAIN = "stripped.tether.invalid";

export function syntheticName(): string {
  return SYNTHETIC_NAME;
}

export function syntheticEmail(): string {
  return `${randomUUID()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
