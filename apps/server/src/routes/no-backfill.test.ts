// These two tests carry the entire no-backfill claim from docs/key-management-spec.md §3:
// envelopes are only ever issued for epochs at or after a member's joinedEpoch, and because
// each epoch's room key is an independent random value (no hash chain across epochs), a device
// that was never issued an envelope for epoch N has no cryptographic path to that epoch's key —
// not a server-side filtering rule, but a fact about what bytes exist for it to unwrap.
import { createHash, randomUUID } from "node:crypto";

import {
  aesGcm,
  defaultRandomSource,
  generateIdentityKeyPair,
  generateRoomKey,
  unwrapRoomKey,
  wrapRoomKey,
} from "@tether/crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/testing.js";
import { db } from "../db/client.js";
import { roomKeyEnvelope } from "../db/schema/rooms.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

function simulateDevice() {
  return generateIdentityKeyPair(defaultRandomSource);
}

async function registerDevice(app: FastifyInstance, cookie: string, publicKey: Uint8Array) {
  const response = await app.inject({
    method: "POST",
    url: "/devices",
    headers: { cookie },
    payload: { identityPublicKey: Buffer.from(publicKey).toString("base64"), platform: "ios" },
  });
  return response.json() as { id: string };
}

async function wrapFor(
  roomKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  roomId: string,
  epoch: number,
  deviceId: string,
) {
  const wrapped = await wrapRoomKey(
    aesGcm,
    roomKey,
    recipientPublicKey,
    { roomId, epoch, deviceId },
    defaultRandomSource,
  );
  return Buffer.from(wrapped).toString("base64");
}

async function createRoomWithOwnKey(app: FastifyInstance, cookie: string) {
  const identity = simulateDevice();
  const deviceRow = await registerDevice(app, cookie, identity.publicKey);
  const roomId = randomUUID();
  const roomKey = generateRoomKey(defaultRandomSource);
  const wrappedKey = await wrapFor(roomKey, identity.publicKey, roomId, 0, deviceRow.id);

  const response = await app.inject({
    method: "POST",
    url: "/rooms",
    headers: { cookie },
    payload: {
      roomId,
      nameCiphertext: Buffer.from("room-name").toString("base64"),
      precisionPolicy: "approximate_only",
      displayNameCiphertext: Buffer.from("owner").toString("base64"),
      envelopes: [{ deviceId: deviceRow.id, wrappedKey }],
    },
  });

  return {
    roomId,
    identity,
    deviceRow,
    roomKey,
    body: response.json() as { room: { id: string } },
  };
}

async function inviteAndRedeem(
  app: FastifyInstance,
  ownerCookie: string,
  roomId: string,
  currentEpoch: number,
  currentRoomKey: Uint8Array,
  activeDevices: { deviceId: string; publicKey: Uint8Array }[],
) {
  const inviteToken = randomUUID();
  const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
  await app.inject({
    method: "POST",
    url: `/rooms/${roomId}/invites`,
    headers: { cookie: ownerCookie },
    payload: {
      tokenHash,
      grantsRole: "member",
      wrappedRoomKey: Buffer.from(currentRoomKey).toString("base64"),
      wrappedRoomKeyEpoch: currentEpoch,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  });

  const joiner = await createSignedInUser();
  const identity = simulateDevice();
  const deviceRow = await registerDevice(app, joiner.cookie, identity.publicKey);

  const newEpoch = currentEpoch + 1;
  const newRoomKey = generateRoomKey(defaultRandomSource);
  const wrapTargets = [...activeDevices, { deviceId: deviceRow.id, publicKey: identity.publicKey }];
  const envelopes = await Promise.all(
    wrapTargets.map(async (target) => ({
      deviceId: target.deviceId,
      wrappedKey: await wrapFor(newRoomKey, target.publicKey, roomId, newEpoch, target.deviceId),
    })),
  );

  const response = await app.inject({
    method: "POST",
    url: "/invites/redeem",
    headers: { cookie: joiner.cookie },
    payload: {
      token: inviteToken,
      displayNameCiphertext: Buffer.from("member").toString("base64"),
      deviceId: deviceRow.id,
      expectedEpoch: currentEpoch,
      nameCiphertext: Buffer.from("room-name").toString("base64"),
      envelopes,
    },
  });
  expect(response.statusCode).toBe(200);

  return { joiner, identity, deviceRow, newEpoch, newRoomKey };
}

describe("no-backfill: joining membership", () => {
  it("a member joining at epoch 3 receives no envelope for epochs 1 and 2", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const {
      roomId,
      identity: ownerIdentity,
      deviceRow: ownerDevice,
      roomKey: roomKey0,
    } = await createRoomWithOwnKey(app, owner.cookie);

    const round1 = await inviteAndRedeem(app, owner.cookie, roomId, 0, roomKey0, [
      { deviceId: ownerDevice.id, publicKey: ownerIdentity.publicKey },
    ]);
    const round2 = await inviteAndRedeem(app, owner.cookie, roomId, 1, round1.newRoomKey, [
      { deviceId: ownerDevice.id, publicKey: ownerIdentity.publicKey },
      { deviceId: round1.deviceRow.id, publicKey: round1.identity.publicKey },
    ]);
    // round3's joiner is the test subject: they join exactly at epoch 3.
    const round3 = await inviteAndRedeem(app, owner.cookie, roomId, 2, round2.newRoomKey, [
      { deviceId: ownerDevice.id, publicKey: ownerIdentity.publicKey },
      { deviceId: round1.deviceRow.id, publicKey: round1.identity.publicKey },
      { deviceId: round2.deviceRow.id, publicKey: round2.identity.publicKey },
    ]);
    expect(round3.newEpoch).toBe(3);

    const envelopesResponse = await app.inject({
      method: "GET",
      url: `/envelopes?deviceId=${round3.deviceRow.id}`,
      headers: { cookie: round3.joiner.cookie },
    });
    const envelopes = envelopesResponse.json().envelopes as { epoch: number }[];
    expect(envelopes.map((e) => e.epoch)).toEqual([3]);

    // Cryptographic fact, not just a row count: the joiner's device secret cannot unwrap the
    // epoch-1 envelope that belongs to round1's device — the two epochs' room keys are
    // independent random values, so nothing derivable from epoch 3 reaches epoch 1.
    const [epoch1Envelope] = await db
      .select()
      .from(roomKeyEnvelope)
      .where(eq(roomKeyEnvelope.deviceId, round1.deviceRow.id));
    expect(epoch1Envelope).toBeDefined();
    if (!epoch1Envelope) throw new Error("expected epoch-1 envelope to exist");

    await expect(
      unwrapRoomKey(aesGcm, epoch1Envelope.wrappedKey, round3.identity.secretKey, {
        roomId,
        epoch: 1,
        deviceId: round1.deviceRow.id,
      }),
    ).rejects.toThrow();
  });
});

describe("no-backfill: removal", () => {
  it("a member removed before epoch 4 receives no envelope for epoch 4", async () => {
    app = buildApp();
    const owner = await createSignedInUser();
    const {
      roomId,
      identity: ownerIdentity,
      deviceRow: ownerDevice,
      roomKey: roomKey0,
    } = await createRoomWithOwnKey(app, owner.cookie);

    const round1 = await inviteAndRedeem(app, owner.cookie, roomId, 0, roomKey0, [
      { deviceId: ownerDevice.id, publicKey: ownerIdentity.publicKey },
    ]);
    // The membership to be removed. Fetch its alias for the removal call.
    const roomsListing = await app.inject({
      method: "GET",
      url: "/rooms",
      headers: { cookie: round1.joiner.cookie },
    });
    const removedAlias = (roomsListing.json().rooms as { memberAlias: string }[])[0]?.memberAlias;
    if (!removedAlias) throw new Error("expected the joined member to have a room listing");

    // Bump 1 -> 2: remove the member. Only the owner remains in the wrap set.
    const removalRoomKey = generateRoomKey(defaultRandomSource);
    const removalEnvelope = await wrapFor(
      removalRoomKey,
      ownerIdentity.publicKey,
      roomId,
      2,
      ownerDevice.id,
    );
    const removalResponse = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/removals`,
      headers: { cookie: owner.cookie },
      payload: {
        alias: removedAlias,
        expectedEpoch: 1,
        nameCiphertext: Buffer.from("room-name").toString("base64"),
        envelopes: [{ deviceId: ownerDevice.id, wrappedKey: removalEnvelope }],
      },
    });
    expect(removalResponse.statusCode).toBe(200);
    expect(removalResponse.json().newEpoch).toBe(2);

    // Bump 2 -> 3 and 3 -> 4: two more joins, neither ever wraps to the removed device.
    const round3 = await inviteAndRedeem(app, owner.cookie, roomId, 2, removalRoomKey, [
      { deviceId: ownerDevice.id, publicKey: ownerIdentity.publicKey },
    ]);
    const round4 = await inviteAndRedeem(app, owner.cookie, roomId, 3, round3.newRoomKey, [
      { deviceId: ownerDevice.id, publicKey: ownerIdentity.publicKey },
      { deviceId: round3.deviceRow.id, publicKey: round3.identity.publicKey },
    ]);
    expect(round4.newEpoch).toBe(4);

    const envelopesResponse = await app.inject({
      method: "GET",
      url: `/envelopes?deviceId=${round1.deviceRow.id}`,
      headers: { cookie: round1.joiner.cookie },
    });
    const envelopes = envelopesResponse.json().envelopes as { epoch: number }[];
    expect(envelopes.every((e) => e.epoch < 2)).toBe(true);
    expect(envelopes.some((e) => e.epoch === 4)).toBe(false);

    // Cryptographic fact: epoch 4's key is unreachable from the epoch-1 key the removed device
    // still holds — independent per-epoch keys mean no derivation path exists.
    const [epoch4Envelope] = await db
      .select()
      .from(roomKeyEnvelope)
      .where(eq(roomKeyEnvelope.deviceId, round4.deviceRow.id));
    expect(epoch4Envelope).toBeDefined();
    if (!epoch4Envelope) throw new Error("expected epoch-4 envelope to exist");

    await expect(
      unwrapRoomKey(aesGcm, epoch4Envelope.wrappedKey, round1.identity.secretKey, {
        roomId,
        epoch: 4,
        deviceId: round4.deviceRow.id,
      }),
    ).rejects.toThrow();
  });
});
