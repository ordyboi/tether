import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { InviteLookupResponse, RedeemResponse } from "@tether/api";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/session.js";
import type { RoomSummary } from "@tether/api";
import { createRoom, registerDevice } from "../test-helpers.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

function tokenAndHash() {
  const token = randomUUID();
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
}

async function createInvite(
  app: FastifyInstance,
  cookie: string,
  roomId: string,
  overrides: Partial<{ grantsRole: string; expiresAt: string; tokenHash: string }> = {},
) {
  const { token, tokenHash } = tokenAndHash();
  const wrappedRoomKey = randomBytes(48);
  const response = await app.inject({
    method: "POST",
    url: `/rooms/${roomId}/invites`,
    headers: { cookie },
    payload: {
      tokenHash: overrides.tokenHash ?? tokenHash,
      grantsRole: overrides.grantsRole ?? "member",
      wrappedRoomKey: wrappedRoomKey.toString("base64"),
      wrappedRoomKeyEpoch: 0,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
    },
  });
  return { response, token, wrappedRoomKey };
}

describe("POST /rooms/:roomId/invites", () => {
  it("lets the owner create an invite", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();

    const { response } = await createInvite(app, owner.cookie, created.roomId);
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).not.toHaveProperty("tokenHash");
    expect(body).not.toHaveProperty("createdBy");
  });

  it("403s a non-member trying to create an invite", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();

    const stranger = await createSignedInUser();
    const { response } = await createInvite(app, stranger.cookie, created.roomId);
    expect(response.statusCode).toBe(403);
  });

  it("owner can grant admin", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();

    const { response } = await createInvite(app, owner.cookie, created.roomId, {
      grantsRole: "admin",
    });
    expect(response.statusCode).toBe(201);
  });

  it("400s a grantsRole of owner — never a valid grant", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();

    const { response } = await createInvite(app, owner.cookie, created.roomId, {
      grantsRole: "owner",
    });
    expect(response.statusCode).toBe(400);
  });

  it("400s a tokenHash that is not a 64-character hex digest", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();

    const { response } = await createInvite(app, owner.cookie, created.roomId, {
      tokenHash: "not-a-real-hash",
    });
    expect(response.statusCode).toBe(400);
  });

  it("400s a malformed (non-UUID) roomId", async () => {
    app = buildApp();
    const owner = await createSignedInUser();

    const response = await app.inject({
      method: "POST",
      url: "/rooms/not-a-uuid/invites",
      headers: { cookie: owner.cookie },
      payload: {
        tokenHash: "a".repeat(64),
        grantsRole: "member",
        wrappedRoomKey: randomBytes(48).toString("base64"),
        wrappedRoomKeyEpoch: 0,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("400s an expiresAt further than the max TTL from now", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();

    const { response } = await createInvite(app, owner.cookie, created.roomId, {
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("POST /invites/lookup", () => {
  it("returns invite metadata for a live token, wrappedRoomKey base64-encoded", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();
    const { token, wrappedRoomKey } = await createInvite(app, owner.cookie, created.roomId);

    const response = await app.inject({
      method: "POST",
      url: "/invites/lookup",
      payload: { token },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<InviteLookupResponse>();
    expect(body.roomId).toBe(created.roomId);
    expect(body.wrappedRoomKey).toBe(wrappedRoomKey.toString("base64"));
  });

  it("404s an unknown token", async () => {
    app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/invites/lookup",
      payload: { token: randomUUID() },
    });
    expect(response.statusCode).toBe(404);
  });

  it("404s an expired token", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();
    const { token } = await createInvite(app, owner.cookie, created.roomId, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/invites/lookup",
      payload: { token },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("POST /invites/redeem", () => {
  it("creates a membership at the bumped epoch and marks the invite redeemed", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();
    const { token } = await createInvite(app, owner.cookie, created.roomId);

    const joiner = await createSignedInUser();
    const joinerDevice = await registerDevice(app, joiner.cookie);

    const response = await app.inject({
      method: "POST",
      url: "/invites/redeem",
      headers: { cookie: joiner.cookie },
      payload: {
        token,
        displayNameCiphertext: randomBytes(16).toString("base64"),
        expectedEpoch: 0,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [
          { deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
          { deviceId: joinerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<RedeemResponse>().newEpoch).toBe(1);

    const lookupAfterRedeem = await app.inject({
      method: "POST",
      url: "/invites/lookup",
      payload: { token },
    });
    expect(lookupAfterRedeem.statusCode).toBe(404);
  });

  it("409s redeeming the same invite twice", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();
    const { token } = await createInvite(app, owner.cookie, created.roomId);

    const joiner = await createSignedInUser();
    const joinerDevice = await registerDevice(app, joiner.cookie);
    const redeemPayload = {
      token,
      displayNameCiphertext: randomBytes(16).toString("base64"),
      expectedEpoch: 0,
      nameCiphertext: randomBytes(32).toString("base64"),
      envelopes: [
        { deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
        { deviceId: joinerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
      ],
    };

    await app.inject({
      method: "POST",
      url: "/invites/redeem",
      headers: { cookie: joiner.cookie },
      payload: redeemPayload,
    });

    const second = await createSignedInUser();
    await registerDevice(app, second.cookie);
    const secondResponse = await app.inject({
      method: "POST",
      url: "/invites/redeem",
      headers: { cookie: second.cookie },
      payload: redeemPayload,
    });

    expect(secondResponse.statusCode).toBe(404);
  });

  it("409s a stale expectedEpoch", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = (await createRoom(app, owner.cookie, ownerDevice.id)).json<RoomSummary>();
    const { token } = await createInvite(app, owner.cookie, created.roomId);

    const joiner = await createSignedInUser();
    const joinerDevice = await registerDevice(app, joiner.cookie);

    const response = await app.inject({
      method: "POST",
      url: "/invites/redeem",
      headers: { cookie: joiner.cookie },
      payload: {
        token,
        displayNameCiphertext: randomBytes(16).toString("base64"),
        expectedEpoch: 9,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [
          { deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
          { deviceId: joinerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
        ],
      },
    });

    expect(response.statusCode).toBe(409);
  });
});
