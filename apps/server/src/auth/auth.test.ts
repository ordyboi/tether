import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { db } from "../db/client.js";
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
} from "../db/schema/auth.js";
import { auth } from "./auth.js";

const REAL_NAME = "Real Person";
const REAL_EMAIL = "real.person@gmail.com";

function buildUnsignedGoogleIdToken() {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: "google-subject-123",
      aud: "test-client",
      azp: "test-client",
      email: REAL_EMAIL,
      email_verified: true,
      name: REAL_NAME,
      given_name: "Real",
      family_name: "Person",
      picture: "https://example.com/real-person.jpg",
      iss: "https://accounts.google.com",
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  ).toString("base64url");
  return `${header}.${payload}.unsigned-test-signature`;
}

function assertDefined<T>(value: T | undefined, message: string) {
  expect(value, message).toBeDefined();
  if (value === undefined) throw new Error(message);
  return value;
}

let app: FastifyInstance | null = null;

beforeEach(async () => {
  await db.execute(
    sql`truncate table "user", "session", "account", "verification", "passkey" cascade`,
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app?.close();
  app = null;
});

describe("Google OAuth sign-in strips real PII from the written rows", () => {
  it("writes only synthetic identity and nulled tokens on a successful sign-in", async () => {
    app = buildApp();

    const idToken = buildUnsignedGoogleIdToken();
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "test-access-token",
              refresh_token: "test-refresh-token",
              id_token: idToken,
              token_type: "Bearer",
              expires_in: 3599,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return realFetch(input, init);
      }),
    );

    const { headers, response: authResponse } = await auth.api.signInSocial({
      body: { provider: "google", callbackURL: "/" },
      returnHeaders: true,
    });
    const stateCookie = headers.get("set-cookie");
    expect(stateCookie).toBeTruthy();

    expect(authResponse.url).toBeTruthy();
    const authorizationUrl = new URL(authResponse.url ?? "");
    const state = authorizationUrl.searchParams.get("state");
    expect(state).toBeTruthy();

    const callback = await app.inject({
      method: "GET",
      url: `/api/auth/callback/google?code=test-authorization-code&state=${state}`,
      headers: {
        cookie: stateCookie ?? "",
        "user-agent": "attacker-tracking-user-agent/1.0",
        "x-forwarded-for": "203.0.113.99",
      },
    });

    // Better Auth signals a failed OAuth callback with a 302 to its error
    // page, so a bare status check would pass on a failed sign-in too.
    // Assert the redirect actually lands on the success callbackURL.
    expect(callback.statusCode).toBe(302);
    const location = callback.headers.location;
    expect(location).not.toContain("error");
    expect(new URL(String(location), "http://localhost").pathname).toBe("/");

    const rows = await db.select().from(userTable);
    expect(rows).toHaveLength(1);
    const user = assertDefined(rows[0], "expected the OAuth sign-in to create exactly one user");
    expect(user.name).not.toBe(REAL_NAME);
    expect(user.name).not.toContain("Real");
    expect(user.email).not.toBe(REAL_EMAIL);
    expect(user.email).toMatch(/@stripped\.tether\.invalid$/);
    expect(user.image).toBeNull();

    const [accountRow] = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, user.id));
    expect(accountRow?.accountId).toBe("google-subject-123");
    expect(accountRow?.accessToken).toBeNull();
    expect(accountRow?.refreshToken).toBeNull();
    expect(accountRow?.idToken).toBeNull();

    const [sessionRow] = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, user.id));
    expect(sessionRow?.ipAddress).toBeNull();
    expect(sessionRow?.userAgent).toBeNull();
  });
});
