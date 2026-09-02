import { randomBytes } from "node:crypto";

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
  return app.inject({
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
}

describe("POST /rooms", () => {
  it("creates a room with the caller as owner at epoch 0", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);

    const response = await createRoom(app, owner.cookie, ownerDevice.id);

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.room.currentEpoch).toBe(0);
    expect(typeof body.memberAlias).toBe("string");
  });

  it("400s when the envelope set omits one of the owner's devices", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    await registerDevice(app, owner.cookie);
    await registerDevice(app, owner.cookie);

    const response = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { cookie: owner.cookie },
      payload: {
        nameCiphertext: randomBytes(32).toString("base64"),
        precisionPolicy: "approximate_only",
        displayNameCiphertext: randomBytes(16).toString("base64"),
        envelopes: [
          { deviceId: crypto.randomUUID(), wrappedKey: randomBytes(48).toString("base64") },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /rooms", () => {
  it("lists only the caller's active memberships", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    await createRoom(app, owner.cookie, ownerDevice.id);

    const other = await createSignedInUser();

    const ownerList = await app.inject({
      method: "GET",
      url: "/rooms",
      headers: { cookie: owner.cookie },
    });
    const otherList = await app.inject({
      method: "GET",
      url: "/rooms",
      headers: { cookie: other.cookie },
    });

    expect(ownerList.json().rooms).toHaveLength(1);
    expect(otherList.json().rooms).toHaveLength(0);
  });
});

describe("GET /rooms/:roomId/devices", () => {
  it("returns the current epoch and the caller's own device when solo", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const roomId = created.json().room.id as string;

    const response = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/devices`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.epoch).toBe(0);
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0].deviceId).toBe(ownerDevice.id);
  });

  it("404s for a non-member", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const roomId = created.json().room.id as string;

    const stranger = await createSignedInUser();
    const response = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/devices`,
      headers: { cookie: stranger.cookie },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("POST /rooms/:roomId/removals", () => {
  it("the owner cannot be removed", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const room = created.json().room as { id: string };
    const memberAlias = created.json().memberAlias as string;

    const response = await app.inject({
      method: "POST",
      url: `/rooms/${room.id}/removals`,
      headers: { cookie: owner.cookie },
      payload: {
        alias: memberAlias,
        expectedEpoch: 0,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") }],
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("404s removing an alias that does not exist in the room", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const room = created.json().room as { id: string };

    const response = await app.inject({
      method: "POST",
      url: `/rooms/${room.id}/removals`,
      headers: { cookie: owner.cookie },
      payload: {
        alias: "does-not-exist",
        expectedEpoch: 0,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") }],
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it("403s a removal attempted by a non-owner/admin caller", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const room = created.json().room as { id: string };

    const stranger = await createSignedInUser();
    const response = await app.inject({
      method: "POST",
      url: `/rooms/${room.id}/removals`,
      headers: { cookie: stranger.cookie },
      payload: {
        alias: "someone",
        expectedEpoch: 0,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [
          { deviceId: crypto.randomUUID(), wrappedKey: randomBytes(48).toString("base64") },
        ],
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
