import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

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
  truncateAppTables,
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

describe("runSweeper", () => {
  beforeEach(async () => {
    await truncateAppTables(db);
  });

  it("deletes exactly the rows past their retention boundary, and is idempotent", async () => {
    const kept: { table: "invite" | "fix" | "room_key_envelope"; id: string }[] = [];
    const deleted: { table: "invite" | "fix" | "room_key_envelope"; id: string }[] = [];

    // --- invites ---
    const inviteRoom = await seedRoom(db);
    const expiredInvite = await seedInvite(db, {
      roomId: inviteRoom.id,
      expiresAt: minutesBefore(1),
    });
    const liveInvite = await seedInvite(db, { roomId: inviteRoom.id, expiresAt: minutesAfter(60) });
    deleted.push({ table: "invite", id: expiredInvite.id });
    kept.push({ table: "invite", id: liveInvite.id });

    // --- fixes past 24h ---
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
    deleted.push({ table: "fix", id: oldFix.id });
    kept.push({ table: "fix", id: freshFix.id });

    // --- envelopes ---
    // room with epochs 0 (superseded, no fix), 1 (superseded, fix survives), 2 (nameEpoch), 3 (newest)
    const envelopeRoom = await seedRoom(db, { nameEpoch: 2, currentEpoch: 3 });
    const envelopeRoomMember = await seedMembership(db, { roomId: envelopeRoom.id });
    for (const epoch of [0, 1, 2, 3]) {
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
    deleted.push({
      table: "room_key_envelope",
      id: `${revokedEnvelope.roomId}:${revokedEnvelope.epoch}:${revokedEnvelope.deviceId}`,
    });

    const supersededDevice = await seedDevice(db);
    const supersededOld = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 0,
      deviceId: supersededDevice.id,
    });
    const supersededNewest = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 3,
      deviceId: supersededDevice.id,
    });
    deleted.push({
      table: "room_key_envelope",
      id: `${supersededOld.roomId}:${supersededOld.epoch}:${supersededOld.deviceId}`,
    });
    kept.push({
      table: "room_key_envelope",
      id: `${supersededNewest.roomId}:${supersededNewest.epoch}:${supersededNewest.deviceId}`,
    });

    const survivedByFixDevice = await seedDevice(db);
    const survivedByFixOld = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 1,
      deviceId: survivedByFixDevice.id,
    });
    const survivedByFixNewest = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 3,
      deviceId: survivedByFixDevice.id,
    });
    await seedFix(db, {
      roomId: envelopeRoom.id,
      authorAlias: envelopeRoomMember.memberAlias,
      epoch: 1,
      serverReceivedAt: new Date(NOW.getTime() - MINUTE),
    });
    kept.push({
      table: "room_key_envelope",
      id: `${survivedByFixOld.roomId}:${survivedByFixOld.epoch}:${survivedByFixOld.deviceId}`,
    });
    kept.push({
      table: "room_key_envelope",
      id: `${survivedByFixNewest.roomId}:${survivedByFixNewest.epoch}:${survivedByFixNewest.deviceId}`,
    });

    const nameEpochDevice = await seedDevice(db);
    const nameEpochOld = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 2,
      deviceId: nameEpochDevice.id,
    });
    const nameEpochNewest = await seedEnvelope(db, {
      roomId: envelopeRoom.id,
      epoch: 3,
      deviceId: nameEpochDevice.id,
    });
    kept.push({
      table: "room_key_envelope",
      id: `${nameEpochOld.roomId}:${nameEpochOld.epoch}:${nameEpochOld.deviceId}`,
    });
    kept.push({
      table: "room_key_envelope",
      id: `${nameEpochNewest.roomId}:${nameEpochNewest.epoch}:${nameEpochNewest.deviceId}`,
    });

    // --- precision requests never expire ---
    const requestRoom = await seedRoom(db);
    const requester = await seedMembership(db, { roomId: requestRoom.id });
    const target = await seedMembership(db, { roomId: requestRoom.id });
    const oldRequest = await seedPrecisionRequest(db, {
      roomId: requestRoom.id,
      fromAlias: requester.memberAlias,
      toAlias: target.memberAlias,
    });

    // --- guest membership never expires ---
    const guestRoom = await seedRoom(db);
    const guestMembership = await seedMembership(db, { roomId: guestRoom.id, role: "guest" });

    const result = await runSweeper(db, NOW);

    expect(result).toEqual({ invites: 1, fixes: 1, envelopes: 2 });

    for (const row of kept) {
      const survives = await rowExists(row.table, row.id);
      expect(survives, `${row.table} ${row.id} should have survived`).toBe(true);
    }
    for (const row of deleted) {
      const survives = await rowExists(row.table, row.id);
      expect(survives, `${row.table} ${row.id} should have been deleted`).toBe(false);
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
});

async function rowExists(table: "invite" | "fix" | "room_key_envelope", id: string) {
  if (table === "invite") {
    const rows = await db.select().from(invite).where(eq(invite.id, id));
    return rows.length > 0;
  }
  if (table === "fix") {
    const rows = await db.select().from(fix).where(eq(fix.id, id));
    return rows.length > 0;
  }
  const [roomId, epoch, deviceId] = id.split(":");
  const rows = await db
    .select()
    .from(roomKeyEnvelope)
    .where(eq(roomKeyEnvelope.roomId, roomId ?? ""));
  return rows.some((row) => String(row.epoch) === epoch && row.deviceId === deviceId);
}
