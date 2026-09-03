import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../db/client.js";
import { invite, membership } from "../db/schema/membership.js";
import { roomKeyEnvelope } from "../db/schema/rooms.js";
import { seedDevice, seedEpoch, seedMembership, seedRoom, seedUser } from "../db/testing.js";
import { StaleEpochError, WrapSetMismatchError } from "../errors.js";
import { type ApplyRekeyParams, createRoom, runRekey } from "./rekey.js";

function applyRekey(params: ApplyRekeyParams) {
  return db.transaction((tx) => runRekey(tx, params));
}

describe("createRoom", () => {
  it("writes room, epoch 0, the owner membership and the owner's epoch-0 envelope", async () => {
    const owner = await seedUser(db);
    const ownerDevice = await seedDevice(db, { userId: owner.id });

    const created = await createRoom(db, {
      ownerId: owner.id,
      memberAlias: "owner-alias",
      nameCiphertext: randomBytes(32),
      displayNameCiphertext: randomBytes(16),
      precisionPolicy: "approximate_only",
      envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48) }],
    });

    expect(created.currentEpoch).toBe(0);
    expect(created.nameEpoch).toBe(0);

    const envelopes = await db
      .select()
      .from(roomKeyEnvelope)
      .where(and(eq(roomKeyEnvelope.roomId, created.id), eq(roomKeyEnvelope.epoch, 0)));
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.deviceId).toBe(ownerDevice.id);
  });

  it("rejects a wrap set missing one of the owner's devices", async () => {
    const owner = await seedUser(db);
    await seedDevice(db, { userId: owner.id });
    await seedDevice(db, { userId: owner.id });

    await expect(
      createRoom(db, {
        ownerId: owner.id,
        memberAlias: "owner-alias",
        nameCiphertext: randomBytes(32),
        displayNameCiphertext: randomBytes(16),
        precisionPolicy: "approximate_only",
        envelopes: [{ deviceId: crypto.randomUUID(), wrappedKey: randomBytes(48) }],
      }),
    ).rejects.toBeInstanceOf(WrapSetMismatchError);
  });
});

describe("applyRekey", () => {
  async function seedRoomAtEpochZero() {
    const owner = await seedUser(db);
    const ownerDevice = await seedDevice(db, { userId: owner.id });
    const seededRoom = await seedRoom(db, { ownerId: owner.id, currentEpoch: 0 });
    await seedEpoch(db, { roomId: seededRoom.id, epoch: 0, reason: "created" });
    await seedMembership(db, {
      roomId: seededRoom.id,
      userId: owner.id,
      memberAlias: "owner-alias",
      role: "owner",
      joinedEpoch: 0,
    });
    return { owner, ownerDevice, room: seededRoom };
  }

  it("runs the membership mutation before computing the required device set, so a joiner is included", async () => {
    const { room: seededRoom, ownerDevice } = await seedRoomAtEpochZero();
    const joiner = await seedUser(db);
    const joinerDevice = await seedDevice(db, { userId: joiner.id });

    const result = await applyRekey({
      roomId: seededRoom.id,
      expectedEpoch: 0,
      reason: "member_joined",
      nameCiphertext: randomBytes(32),
      envelopes: [
        { deviceId: ownerDevice.id, wrappedKey: randomBytes(48) },
        { deviceId: joinerDevice.id, wrappedKey: randomBytes(48) },
      ],
      async mutateMembership(tx, newEpoch) {
        await tx.insert(membership).values({
          roomId: seededRoom.id,
          userId: joiner.id,
          memberAlias: "joiner-alias",
          displayNameCiphertext: randomBytes(16),
          role: "member",
          joinedEpoch: newEpoch,
        });
      },
    });

    expect(result.newEpoch).toBe(1);
    const envelopes = await db
      .select()
      .from(roomKeyEnvelope)
      .where(and(eq(roomKeyEnvelope.roomId, seededRoom.id), eq(roomKeyEnvelope.epoch, 1)));
    expect(envelopes.map((row) => row.deviceId).sort()).toEqual(
      [ownerDevice.id, joinerDevice.id].sort(),
    );
  });

  it("excludes a removed member's device from the required set the same bump their removal is applied in", async () => {
    const { room: seededRoom, ownerDevice } = await seedRoomAtEpochZero();
    const member = await seedUser(db);
    const memberDevice = await seedDevice(db, { userId: member.id });
    const membershipRow = await seedMembership(db, {
      roomId: seededRoom.id,
      userId: member.id,
      memberAlias: "member-alias",
      role: "member",
      joinedEpoch: 0,
    });
    await applyRekey({
      roomId: seededRoom.id,
      expectedEpoch: 0,
      reason: "member_joined",
      nameCiphertext: randomBytes(32),
      envelopes: [
        { deviceId: ownerDevice.id, wrappedKey: randomBytes(48) },
        { deviceId: memberDevice.id, wrappedKey: randomBytes(48) },
      ],
      async mutateMembership() {
        // membership already seeded above at epoch 0; this bump only advances the epoch
      },
    });

    const result = await applyRekey({
      roomId: seededRoom.id,
      expectedEpoch: 1,
      reason: "member_removed",
      nameCiphertext: randomBytes(32),
      envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48) }],
      async mutateMembership(tx) {
        await tx
          .update(membership)
          .set({ removedAt: new Date() })
          .where(eq(membership.id, membershipRow.id));
      },
    });

    expect(result.newEpoch).toBe(2);
    const envelopes = await db
      .select()
      .from(roomKeyEnvelope)
      .where(and(eq(roomKeyEnvelope.roomId, seededRoom.id), eq(roomKeyEnvelope.epoch, 2)));
    expect(envelopes.map((row) => row.deviceId)).toEqual([ownerDevice.id]);
  });

  it("409s when expectedEpoch is stale", async () => {
    const { room: seededRoom, ownerDevice } = await seedRoomAtEpochZero();
    await expect(
      applyRekey({
        roomId: seededRoom.id,
        expectedEpoch: 5,
        reason: "member_joined",
        nameCiphertext: randomBytes(32),
        envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48) }],
        async mutateMembership() {},
      }),
    ).rejects.toBeInstanceOf(StaleEpochError);
  });

  it("400s when the submitted wrap set is missing a required device", async () => {
    const { room: seededRoom } = await seedRoomAtEpochZero();
    await expect(
      applyRekey({
        roomId: seededRoom.id,
        expectedEpoch: 0,
        reason: "member_joined",
        nameCiphertext: randomBytes(32),
        envelopes: [],
        async mutateMembership() {},
      }),
    ).rejects.toBeInstanceOf(WrapSetMismatchError);
  });

  it("400s when the submitted wrap set includes a device outside the required set", async () => {
    const { room: seededRoom, ownerDevice } = await seedRoomAtEpochZero();
    await expect(
      applyRekey({
        roomId: seededRoom.id,
        expectedEpoch: 0,
        reason: "member_joined",
        nameCiphertext: randomBytes(32),
        envelopes: [
          { deviceId: ownerDevice.id, wrappedKey: randomBytes(48) },
          { deviceId: crypto.randomUUID(), wrappedKey: randomBytes(48) },
        ],
        async mutateMembership() {},
      }),
    ).rejects.toBeInstanceOf(WrapSetMismatchError);
  });

  it("400s a wrap set with a duplicate deviceId instead of violating the envelope primary key", async () => {
    const { room: seededRoom, ownerDevice } = await seedRoomAtEpochZero();
    await expect(
      applyRekey({
        roomId: seededRoom.id,
        expectedEpoch: 0,
        reason: "member_joined",
        nameCiphertext: randomBytes(32),
        envelopes: [
          { deviceId: ownerDevice.id, wrappedKey: randomBytes(48) },
          { deviceId: ownerDevice.id, wrappedKey: randomBytes(48) },
        ],
        async mutateMembership() {},
      }),
    ).rejects.toBeInstanceOf(WrapSetMismatchError);
  });

  it("revokes every outstanding invite for the room on a bump", async () => {
    const { room: seededRoom, ownerDevice } = await seedRoomAtEpochZero();
    const [inviteRow] = await db
      .insert(invite)
      .values({
        roomId: seededRoom.id,
        tokenHash: "a".repeat(64),
        grantsRole: "member",
        wrappedRoomKey: randomBytes(48),
        wrappedRoomKeyEpoch: 0,
        createdBy: (await seedUser(db)).id,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();
    if (!inviteRow) throw new Error("expected invite insert to return a row");

    await applyRekey({
      roomId: seededRoom.id,
      expectedEpoch: 0,
      reason: "member_joined",
      nameCiphertext: randomBytes(32),
      envelopes: [{ deviceId: ownerDevice.id, wrappedKey: randomBytes(48) }],
      async mutateMembership() {},
    });

    const [afterBump] = await db.select().from(invite).where(eq(invite.id, inviteRow.id));
    expect(afterBump?.revokedAt).not.toBeNull();
  });
});
