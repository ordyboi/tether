import { randomBytes, randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/testing.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

async function registerDevice(app: FastifyInstance, cookie: string) {
  const response = await app.inject({
    method: "POST",
    url: "/devices",
    headers: { cookie },
    payload: { identityPublicKey: randomBytes(32).toString("base64"), platform: "ios" },
  });
  return response.json() as { id: string };
}

async function createRoom(app: FastifyInstance, cookie: string, ownerDeviceId: string) {
  const response = await app.inject({
    method: "POST",
    url: "/rooms",
    headers: { cookie },
    payload: {
      nameCiphertext: randomBytes(32).toString("base64"),
      precisionPolicy: "approximate_only",
      displayNameCiphertext: randomBytes(16).toString("base64"),
      envelopes: [{ deviceId: ownerDeviceId, wrappedKey: randomBytes(48).toString("base64") }],
    },
  });
  return response.json() as { room: { id: string }; memberAlias: string };
}

describe("GET /envelopes", () => {
  it("serves the caller's own device its epoch-0 envelope", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);

    const response = await app.inject({
      method: "GET",
      url: `/envelopes?deviceId=${ownerDevice.id}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.envelopes).toHaveLength(1);
    expect(body.envelopes[0].roomId).toBe(created.room.id);
    expect(body.envelopes[0].epoch).toBe(0);
  });

  it("404s a deviceId the caller does not own", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    await registerDevice(app, owner.cookie);

    const stranger = await createSignedInUser();
    const strangerDevice = await registerDevice(app, stranger.cookie);

    const response = await app.inject({
      method: "GET",
      url: `/envelopes?deviceId=${strangerDevice.id}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(404);
  });

  it("404s an unknown deviceId", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    await registerDevice(app, owner.cookie);

    const response = await app.inject({
      method: "GET",
      url: `/envelopes?deviceId=${randomUUID()}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(404);
  });

  it("filters by roomId and sinceEpoch", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);

    const filtered = await app.inject({
      method: "GET",
      url: `/envelopes?deviceId=${ownerDevice.id}&roomId=${created.room.id}&sinceEpoch=1`,
      headers: { cookie: owner.cookie },
    });

    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().envelopes).toHaveLength(0);
  });
});
