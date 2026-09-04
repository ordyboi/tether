import { randomBytes } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/session.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

describe("POST /devices", () => {
  it("registers a device for the caller", async () => {
    app = buildApp();
    const { cookie } = await createSignedInUser();
    const identityPublicKey = randomBytes(32).toString("base64");

    const response = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { cookie },
      payload: { identityPublicKey, platform: "android" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.platform).toBe("android");
    expect(body.identityPublicKey).toBe(identityPublicKey);
    expect(body.userId).toBeUndefined();
    expect(body.pushToken).toBeUndefined();
    expect(body.revokedAt).toBeNull();
  });

  it("400s an identityPublicKey that is not exactly 32 bytes", async () => {
    app = buildApp();
    const { cookie } = await createSignedInUser();

    const response = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { cookie },
      payload: { identityPublicKey: randomBytes(3).toString("base64"), platform: "ios" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns the existing row when the caller re-registers the same key", async () => {
    app = buildApp();
    const { cookie } = await createSignedInUser();
    const identityPublicKey = randomBytes(32).toString("base64");

    const first = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { cookie },
      payload: { identityPublicKey, platform: "ios" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { cookie },
      payload: { identityPublicKey, platform: "ios" },
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    expect(second.json().userId).toBeUndefined();
    expect(second.json().pushToken).toBeUndefined();
  });

  it("409s when the identityPublicKey belongs to another user", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const other = await createSignedInUser();
    const identityPublicKey = randomBytes(32).toString("base64");

    await app.inject({
      method: "POST",
      url: "/devices",
      headers: { cookie: owner.cookie },
      payload: { identityPublicKey, platform: "ios" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { cookie: other.cookie },
      payload: { identityPublicKey, platform: "ios" },
    });

    expect(response.statusCode).toBe(409);
  });

  it("401s without a session", async () => {
    app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/devices",
      payload: { identityPublicKey: randomBytes(32).toString("base64"), platform: "ios" },
    });
    expect(response.statusCode).toBe(401);
  });
});
