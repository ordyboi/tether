import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { db } from "../db/client.js";
import { session as sessionTable, user as userTable } from "../db/schema/auth.js";
import { truncateAuthTables } from "./test-helpers.js";

let app: FastifyInstance | null = null;

beforeEach(async () => {
  await truncateAuthTables();
});

afterEach(async () => {
  await app?.close();
  app = null;
});

describe("auth plugins are mounted and functional", () => {
  it("mounts anonymous sign-in and creates a synthetic-email user with a null-IP session", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/anonymous",
      headers: {
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "plugin-test-agent/1.0",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.user.email).toMatch(/@stripped\.tether\.invalid$/);

    const [userRow] = await db.select().from(userTable).where(eq(userTable.id, body.user.id));
    expect(userRow?.email).toMatch(/@stripped\.tether\.invalid$/);

    const [sessionRow] = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, body.user.id));
    expect(sessionRow?.ipAddress).toBeNull();
    expect(sessionRow?.userAgent).toBeNull();
  });

  it("mounts the passkey registration-options endpoint behind a session", async () => {
    app = buildApp();

    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/anonymous",
    });
    const cookie = signIn.headers["set-cookie"];
    expect(cookie).toBeDefined();

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/passkey/generate-register-options",
      headers: { cookie: Array.isArray(cookie) ? cookie.join("; ") : cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("challenge");
  });

  it("mounts the Google and Apple social sign-in endpoints", async () => {
    app = buildApp();

    const google = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/social",
      payload: { provider: "google", callbackURL: "/" },
    });
    const apple = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/social",
      payload: { provider: "apple", callbackURL: "/" },
    });

    expect(google.statusCode).toBe(200);
    expect(apple.statusCode).toBe(200);
  });

  it("accepts Apple's form_post callback instead of rejecting it as an invalid media type", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/callback/apple",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "code=test-code&state=nonexistent-state",
    });

    // The state is invalid, so this redirects to Better Auth's error page
    // rather than succeeding - the point of this test is that a
    // urlencoded body reaches the handler at all (previously a 415).
    expect(response.statusCode).not.toBe(415);
  });
});
