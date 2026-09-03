import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/session.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

describe("declared request schema validation", () => {
  it("400s a schema failure with { error, issues } once authenticated", async () => {
    app = buildApp();
    const { cookie } = await createSignedInUser();

    const response = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { cookie },
      payload: { identityPublicKey: "not-base64!!", platform: "ios" },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("invalid request body");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("401s an unauthenticated request with a malformed body, not 400", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/devices",
      payload: { identityPublicKey: "not-base64!!" },
    });

    expect(response.statusCode).toBe(401);
  });
});
