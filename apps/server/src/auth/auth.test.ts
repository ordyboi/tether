import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { db } from "../db/client.js";
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
} from "../db/schema/auth.js";
import { auth } from "./auth.js";
import { truncateAuthTables } from "./test-helpers.js";

const REAL_NAME = "Real Person";
const REAL_EMAIL = "real.person@gmail.com";

function buildUnsignedGoogleIdToken(): string {
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

beforeEach(async () => {
  await truncateAuthTables();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google OAuth sign-in strips real PII from the written rows", () => {
  it("writes only synthetic identity, nulled tokens, and a null-IP session", async () => {
    const app = buildApp();

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

    await app.close();

    expect(callback.statusCode).toBeLessThan(400);

    const rows = await db.select().from(userTable);
    expect(rows).toHaveLength(1);
    const user = rows[0];
    expect(user).toBeDefined();
    expect(user?.name).not.toBe(REAL_NAME);
    expect(user?.name).not.toContain("Real");
    expect(user?.email).not.toBe(REAL_EMAIL);
    expect(user?.email).toMatch(/@stripped\.tether\.invalid$/);
    expect(user?.image).toBeNull();

    const [accountRow] = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, user?.id ?? ""));
    expect(accountRow?.accountId).toBe("google-subject-123");
    expect(accountRow?.accessToken).toBeNull();
    expect(accountRow?.refreshToken).toBeNull();
    expect(accountRow?.idToken).toBeNull();

    const [sessionRow] = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, user?.id ?? ""));
    expect(sessionRow?.ipAddress).toBeNull();
    expect(sessionRow?.userAgent).toBeNull();
  });
});
