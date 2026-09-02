import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../db/client.js";
import { fix } from "../db/schema/fixes.js";
import { invite, membership } from "../db/schema/membership.js";
import { precisionRequest } from "../db/schema/precision.js";
import { roomKeyEnvelope } from "../db/schema/rooms.js";
import {
  seedDevice,
  seedEnvelope,
  seedEpoch,
  seedFix,
  seedInvite,
  seedMembership,
  seedPrecisionRequest,
  seedRoom,
} from "../db/testing.js";
import { runSweeper } from "./sweeper.js";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function minutesBefore(minutes: number) {
  return new Date(NOW.getTime() - minutes * MINUTE);
}

function minutesAfter(minutes: number) {
  return new Date(NOW.getTime() + minutes * MINUTE);
}

type Assertion = { label: string; expected: boolean; check: () => Promise<boolean> };

function expectInvite(assertions: Assertion[], id: string, expected: boolean) {
  assertions.push({
    label: `invite ${id}`,
    expected,
    check: async () => (await db.select().from(invite).where(eq(invite.id, id))).length > 0,
  });
}

function expectFix(assertions: Assertion[], id: string, expected: boolean) {
  assertions.push({
    label: `fix ${id}`,
    expected,
    check: async () => (await db.select().from(fix).where(eq(fix.id, id))).length > 0,
  });
}

function expectEnvelope(
  assertions: Assertion[],
  envelope: { roomId: string; epoch: number; deviceId: string },
  expected: boolean,
) {
  assertions.push({
    label: `envelope ${envelope.roomId}/${envelope.epoch}/${envelope.deviceId}`,
    expected,
    check: async () =>
      (
        await db
          .select()
          .from(roomKeyEnvelope)
          .where(
            and(
              eq(roomKeyEnvelope.roomId, envelope.roomId),
              eq(roomKeyEnvelope.epoch, envelope.epoch),
              eq(roomKeyEnvelope.deviceId, envelope.deviceId),
            ),
          )
      ).length > 0,
  });
}

describe("runSweeper", () => {
  it("deletes exactly the rows past their retention boundary, and is idempotent", async () => {
    const assertions: Assertion[] = [];

    const inviteRoom = await seedRoom(db);
    const expiredInvite = await seedInvite(db, {
      roomId: inviteRoom.id,
      expiresAt: minutesBefore(1),
    });
    const liveInvite = await seedInvite(db, { roomId: inviteRoom.id, expiresAt: minutesAfter(60) });
    expectInvite(assertions, expiredInvite.id, false);
    expectInvite(assertions, liveInvite.id, true);

    const fixRoom = await seedRoom(db);
    const fixMember = await seedMembership(db, { roomId: fixRoom.id });
    const oldFix = await seedFix(db, {
      roomId: fixRoom.id,
      authorAlias: fixMember.memberAlias,
      serverReceivedAt: new Date(NOW.getTime() - 24 * HOUR - MINUTE),
    });
    const freshFix = await seedFix(db, {
      roomId: fixRoom.id,
      authorAlias: fixMember.memberAlias,
      serverReceivedAt: new Date(NOW.getTime() - 23 * HOUR - 59 * MINUTE),
    });
    expectFix(assertions, oldFix.id, false);
    expectFix(assertions, freshFix.id, true);

    // envelopeRoom epochs: 0 (superseded, no fix), 1 (superseded, fix survives), 2 (nameEpoch),
    // 3 (newest), 4 (superseded, fix is stale and only deleted if the fix sweep runs first)
    const envelopeRoom = await seedRoom(db, { nameEpoch: 2, currentEpoch: 5 });
    const envelopeRoomMember = await seedMembership(db, { roomId: envelopeRoom.id });
    for (const epoch of [0, 1, 2, 3, 4, 5]) {
      await seedEpoch(db, {
        roomId: envelopeRoom.id,
        epoch,
        reason: epoch === 0 ? "created" : "member_joined",
      });
    }

    const revokedDevice = await seedDevice(db, { revokedAt: new Date() });
    const revokedEnvelope = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 3,
      deviceId: revokedDevice.id,
    });
    expectEnvelope(assertions, revokedEnvelope, false);

    const supersededDevice = await seedDevice(db);
    const supersededOld = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 0,
      deviceId: supersededDevice.id,
    });
    const supersededNewest = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 5,
      deviceId: supersededDevice.id,
    });
    expectEnvelope(assertions, supersededOld, false);
    expectEnvelope(assertions, supersededNewest, true);

    const survivedByFixDevice = await seedDevice(db);
    const survivedByFixOld = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 1,
      deviceId: survivedByFixDevice.id,
    });
    const survivedByFixNewest = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 5,
      deviceId: survivedByFixDevice.id,
    });
    await seedFix(db, {
      roomId: envelopeRoom.id,
      authorAlias: envelopeRoomMember.memberAlias,
      epoch: 1,
      serverReceivedAt: new Date(NOW.getTime() - MINUTE),
    });
    expectEnvelope(assertions, survivedByFixOld, true);
    expectEnvelope(assertions, survivedByFixNewest, true);

    const nameEpochDevice = await seedDevice(db);
    const nameEpochOld = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 2,
      deviceId: nameEpochDevice.id,
    });
    const nameEpochNewest = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 5,
      deviceId: nameEpochDevice.id,
    });
    expectEnvelope(assertions, nameEpochOld, true);
    expectEnvelope(assertions, nameEpochNewest, true);

    // ordering: the fix at epoch 4 is already past retention, so it only stops protecting this
    // envelope if the fix sweep has run first — this is the case that catches the two delete
    // steps being reordered, which nothing else here depends on.
    const orderingDevice = await seedDevice(db);
    const orderingOld = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 4,
      deviceId: orderingDevice.id,
    });
    const orderingNewest = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 5,
      deviceId: orderingDevice.id,
    });
    await seedFix(db, {
      roomId: envelopeRoom.id,
      authorAlias: envelopeRoomMember.memberAlias,
      epoch: 4,
      serverReceivedAt: new Date(NOW.getTime() - 24 * HOUR - MINUTE),
    });
    expectEnvelope(assertions, orderingOld, false);
    expectEnvelope(assertions, orderingNewest, true);

    const requestRoom = await seedRoom(db);
    const requester = await seedMembership(db, { roomId: requestRoom.id });
    const target = await seedMembership(db, { roomId: requestRoom.id });
    const oldRequest = await seedPrecisionRequest(db, {
      roomId: requestRoom.id,
      fromAlias: requester.memberAlias,
      toAlias: target.memberAlias,
    });

    const guestRoom = await seedRoom(db);
    const guestMembership = await seedMembership(db, { roomId: guestRoom.id, role: "guest" });

    const result = await runSweeper(db, NOW);

    expect(result).toEqual({ invites: 1, fixes: 2, envelopes: 3 });

    for (const assertion of assertions) {
      expect(await assertion.check(), assertion.label).toBe(assertion.expected);
    }

    const [requestStillThere] = await db
      .select()
      .from(precisionRequest)
      .where(eq(precisionRequest.id, oldRequest.id));
    expect(requestStillThere).toBeDefined();

    const [guestStillThere] = await db
      .select()
      .from(membership)
      .where(eq(membership.id, guestMembership.id));
    expect(guestStillThere).toBeDefined();

    const second = await runSweeper(db, NOW);
    expect(second).toEqual({ invites: 0, fixes: 0, envelopes: 0 });
  });

  it("compares timestamps in UTC regardless of the host's local timezone", async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/New_York";

    try {
      const room = await seedRoom(db);
      const expiredInvite = await seedInvite(db, {
        roomId: room.id,
        expiresAt: minutesBefore(1),
      });
      const member = await seedMembership(db, { roomId: room.id });
      const oldFix = await seedFix(db, {
        roomId: room.id,
        authorAlias: member.memberAlias,
        serverReceivedAt: new Date(NOW.getTime() - 24 * HOUR - MINUTE),
      });

      const result = await runSweeper(db, NOW);

      expect(result.invites).toBe(1);
      expect(result.fixes).toBe(1);

      const [inviteStillThere] = await db
        .select()
        .from(invite)
        .where(eq(invite.id, expiredInvite.id));
      expect(inviteStillThere).toBeUndefined();

      const [fixStillThere] = await db.select().from(fix).where(eq(fix.id, oldFix.id));
      expect(fixStillThere).toBeUndefined();
    } finally {
      process.env.TZ = originalTz;
    }
  });
});
