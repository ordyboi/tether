import { createHash, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/testing.js";
import { db } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { json } from "../test-utils.js";

interface DeviceResponse {
  id: string;
}

interface RoomCreateResponse {
  room: { id: string; nameCiphertext: string };
  memberAlias: string;
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

async function createRoom(
  app: FastifyInstance,
  cookie: string,
  ownerDeviceId: string,
  roomId?: string,
) {
  return app.inject({
    method: "POST",
    url: "/rooms",
    headers: { cookie },
    payload: {
      roomId,
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
    const body = json<RoomCreateResponse>(response);
    expect(typeof body.memberAlias).toBe("string");
  });

  it("returns nameCiphertext as base64, matching what the request accepted", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const nameCiphertext = randomBytes(32);

    const response = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { cookie: owner.cookie },
      payload: {
        nameCiphertext: nameCiphertext.toString("base64"),
        precisionPolicy: "approximate_only",
        displayNameCiphertext: randomBytes(16).toString("base64"),
        envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") }],
      },
    });

    const body = json<RoomCreateResponse>(response);
    expect(body.room.nameCiphertext).toBe(nameCiphertext.toString("base64"));
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

  it("409s a client-supplied roomId that already exists", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const roomId = crypto.randomUUID();

    const first = await createRoom(app, owner.cookie, ownerDevice.id, roomId);
    expect(first.statusCode).toBe(201);

    const second = await createRoom(app, owner.cookie, ownerDevice.id, roomId);
    expect(second.statusCode).toBe(409);
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

    expect(json<{ rooms: unknown[] }>(ownerList).rooms).toHaveLength(1);
    expect(json<{ rooms: unknown[] }>(otherList).rooms).toHaveLength(0);
  });
});

describe("GET /rooms/:roomId/devices", () => {
  it("returns the current epoch and the caller's own device when solo", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const roomId = json<RoomCreateResponse>(created).room.id;

    const response = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/devices`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(200);
    const body = json<{
      epoch: number;
      devices: { deviceId: string; identityPublicKey: string }[];
    }>(response);
    expect(body.epoch).toBe(0);
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0]?.deviceId).toBe(ownerDevice.id);
  });

  it("404s for a non-member", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const roomId = json<RoomCreateResponse>(created).room.id;

    const stranger = await createSignedInUser();
    const response = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/devices`,
      headers: { cookie: stranger.cookie },
    });

    expect(response.statusCode).toBe(404);
  });

  it("400s a malformed (non-UUID) roomId instead of leaking a driver error", async () => {
    app = buildApp();
    const owner = await createSignedInUser();

    const response = await app.inject({
      method: "GET",
      url: "/rooms/not-a-uuid/devices",
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain("select");
  });
});

describe("POST /rooms/:roomId/removals", () => {
  it("the owner cannot be removed", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const { room, memberAlias } = json<RoomCreateResponse>(created);

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
    const { room } = json<RoomCreateResponse>(created);

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

  it("400s a malformed (non-UUID) roomId", async () => {
    app = buildApp();
    const owner = await createSignedInUser();

    const response = await app.inject({
      method: "POST",
      url: "/rooms/not-a-uuid/removals",
      headers: { cookie: owner.cookie },
      payload: {
        alias: "someone",
        expectedEpoch: 0,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [
          { deviceId: crypto.randomUUID(), wrappedKey: randomBytes(48).toString("base64") },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("403s a removal attempted by a non-owner/admin caller", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const { room } = json<RoomCreateResponse>(created);

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

  it("does not revoke the removed member's device", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const { room } = json<RoomCreateResponse>(created);

    const token = randomBytes(16).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await app.inject({
      method: "POST",
      url: `/rooms/${room.id}/invites`,
      headers: { cookie: owner.cookie },
      payload: {
        tokenHash,
        grantsRole: "member",
        wrappedRoomKey: randomBytes(48).toString("base64"),
        wrappedRoomKeyEpoch: 0,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const member = await createSignedInUser();
    const memberDevice = await registerDevice(app, member.cookie);
    const redeemResponse = await app.inject({
      method: "POST",
      url: "/invites/redeem",
      headers: { cookie: member.cookie },
      payload: {
        token,
        displayNameCiphertext: randomBytes(16).toString("base64"),
        expectedEpoch: 0,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [
          { deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
          { deviceId: memberDevice.id, wrappedKey: randomBytes(48).toString("base64") },
        ],
      },
    });
    const { memberAlias: joinedAlias } = json<{ memberAlias: string }>(redeemResponse);

    await app.inject({
      method: "POST",
      url: `/rooms/${room.id}/removals`,
      headers: { cookie: owner.cookie },
      payload: {
        alias: joinedAlias,
        expectedEpoch: 1,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") }],
      },
    });

    const [deviceRow] = await db.select().from(device).where(eq(device.id, memberDevice.id));
    expect(deviceRow?.revokedAt).toBeNull();
  });
});
