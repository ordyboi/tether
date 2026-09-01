import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { db } from "../db/client.js";
import { session as sessionTable, user as userTable } from "../db/schema/auth.js";
import { truncateAuthTables } from "./test-helpers.js";

beforeEach(async () => {
  await truncateAuthTables();
});

describe("auth plugins are mounted and functional", () => {
  it("mounts anonymous sign-in and creates a synthetic-email user with a null-IP session", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/anonymous",
      headers: {
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "plugin-test-agent/1.0",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);

    const body = response.json() as { user: { id: string; email: string } };
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
    const app = buildApp();

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

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("challenge");
  });

  it("mounts the Google and Apple social sign-in endpoints", async () => {
    const app = buildApp();

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

    await app.close();

    expect(google.statusCode).toBe(200);
    expect(google.json().url).toContain("accounts.google.com");

    expect(apple.statusCode).toBe(200);
    expect(apple.json().url).toContain("appleid.apple.com");
  });
});
