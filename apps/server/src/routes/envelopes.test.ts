import { randomBytes, randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/testing.js";
import { json } from "../test-utils.js";

interface DeviceResponse {
  id: string;
}

interface RoomCreateResponse {
  room: { id: string };
  memberAlias: string;
}

interface EnvelopesResponse {
  envelopes: { roomId: string; epoch: number; wrappedKey: string }[];
}

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
  return json<DeviceResponse>(response);
}

async function createRoom(app: FastifyInstance, cookie: string, ownerDeviceId: string) {
  const wrappedKey = randomBytes(48);
  const response = await app.inject({
    method: "POST",
    url: "/rooms",
    headers: { cookie },
    payload: {
      nameCiphertext: randomBytes(32).toString("base64"),
      precisionPolicy: "approximate_only",
      displayNameCiphertext: randomBytes(16).toString("base64"),
      envelopes: [{ deviceId: ownerDeviceId, wrappedKey: wrappedKey.toString("base64") }],
    },
  });
  return { ...json<RoomCreateResponse>(response), wrappedKey };
}

describe("GET /envelopes", () => {
  it("serves the caller's own device its epoch-0 envelope, base64-encoded", async () => {
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
    const body = json<EnvelopesResponse>(response);
    expect(body.envelopes).toHaveLength(1);
    expect(body.envelopes[0]?.roomId).toBe(created.room.id);
    expect(body.envelopes[0]?.epoch).toBe(0);
    expect(body.envelopes[0]?.wrappedKey).toBe(created.wrappedKey.toString("base64"));
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
    expect(json<EnvelopesResponse>(filtered).envelopes).toHaveLength(0);
  });
});
