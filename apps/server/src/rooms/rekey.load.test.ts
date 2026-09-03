// Records the rekey churn number (N devices per epoch bump) at household and 10x-household
// scale, transcribed into docs/rekey-churn.md. Asserts correctness only — no wall-clock
// threshold, so a slow CI runner can't turn this into a flake.
import { createHash, randomUUID } from "node:crypto";

import {
  aesGcm,
  defaultRandomSource,
  generateIdentityKeyPair,
  generateRoomKey,
  wrapRoomKey,
} from "@tether/crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { createSignedInUser } from "../auth/session.js";
import { db } from "../db/client.js";
import { roomKeyEnvelope } from "../db/schema/rooms.js";
import { seedDevice, seedMembership, seedRoom, seedUser } from "../db/testing.js";

interface DeviceResponse {
  id: string;
}

interface RedeemResponse {
  newEpoch: number;
}

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

const LOAD_TEST_TIMEOUT_MS = 60_000;

async function seedActiveDevice(roomId: string) {
  const identity = generateIdentityKeyPair(defaultRandomSource);
  const user = await seedUser(db);
  const deviceRow = await seedDevice(db, {
    userId: user.id,
    identityPublicKey: Buffer.from(identity.publicKey),
  });
  await seedMembership(db, { roomId, userId: user.id, joinedEpoch: 0 });
  return { deviceId: deviceRow.id, identity };
}

async function runChurnCase(householdDevices: number) {
  app = buildApp();
  const owner = await createSignedInUser();
  const roomId = randomUUID();
  const room = await seedRoom(db, {
    id: roomId,
    ownerId: owner.userId,
    currentEpoch: 0,
    nameEpoch: 0,
  });
  await seedMembership(db, { roomId, userId: owner.userId, role: "owner", joinedEpoch: 0 });

  const existingCount = householdDevices - 1; // the Nth device joins via the measured HTTP call
  const existing = [];
  for (let i = 0; i < existingCount; i += 1) {
    existing.push(await seedActiveDevice(roomId));
  }

  const roomKey = generateRoomKey(defaultRandomSource);
  const inviteToken = randomUUID();
  const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
  await app.inject({
    method: "POST",
    url: `/rooms/${roomId}/invites`,
    headers: { cookie: owner.cookie },
    payload: {
      tokenHash,
      grantsRole: "member",
      wrappedRoomKey: Buffer.from(roomKey).toString("base64"),
      wrappedRoomKeyEpoch: 0,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  });

  const joiner = await createSignedInUser();
  const joinerIdentity = generateIdentityKeyPair(defaultRandomSource);
  const joinerDeviceResponse = await app.inject({
    method: "POST",
    url: "/devices",
    headers: { cookie: joiner.cookie },
    payload: {
      identityPublicKey: Buffer.from(joinerIdentity.publicKey).toString("base64"),
      platform: "ios",
    },
  });
  const joinerDeviceId = joinerDeviceResponse.json<DeviceResponse>().id;

  const wrapTargets = [...existing, { deviceId: joinerDeviceId, identity: joinerIdentity }];
  const newEpoch = 1;

  const wrapStart = performance.now();
  const envelopes = await Promise.all(
    wrapTargets.map(async (target) => ({
      deviceId: target.deviceId,
      wrappedKey: Buffer.from(
        await wrapRoomKey(
          aesGcm,
          roomKey,
          target.identity.publicKey,
          { roomId, epoch: newEpoch, deviceId: target.deviceId },
          defaultRandomSource,
        ),
      ).toString("base64"),
    })),
  );
  const wrapMs = performance.now() - wrapStart;

  const serverStart = performance.now();
  const response = await app.inject({
    method: "POST",
    url: "/invites/redeem",
    headers: { cookie: joiner.cookie },
    payload: {
      token: inviteToken,
      displayNameCiphertext: Buffer.from("member").toString("base64"),
      expectedEpoch: 0,
      nameCiphertext: room.nameCiphertext.toString("base64"),
      envelopes,
    },
  });
  const serverMs = performance.now() - serverStart;

  expect(response.statusCode).toBe(200);
  expect(response.json<RedeemResponse>().newEpoch).toBe(newEpoch);

  const writtenEnvelopes = await db
    .select()
    .from(roomKeyEnvelope)
    .where(and(eq(roomKeyEnvelope.roomId, roomId), eq(roomKeyEnvelope.epoch, newEpoch)));
  expect(writtenEnvelopes).toHaveLength(householdDevices);
  const writtenIds = new Set(writtenEnvelopes.map((row) => row.deviceId));
  for (const target of wrapTargets) {
    expect(writtenIds.has(target.deviceId)).toBe(true);
  }

  return { householdDevices, wrapMs, serverMs, totalMs: wrapMs + serverMs };
}

describe("rekey churn load test", () => {
  it(
    "household scale (N = 6) and 10x household scale (N = 60) write exactly N envelope rows on the bump",
    async () => {
      const household = await runChurnCase(6);
      const tenX = await runChurnCase(60);

      console.log("rekey churn:", JSON.stringify({ household, tenX }, null, 2));

      expect(household.householdDevices).toBe(6);
      expect(tenX.householdDevices).toBe(60);
    },
    LOAD_TEST_TIMEOUT_MS,
  );
});
