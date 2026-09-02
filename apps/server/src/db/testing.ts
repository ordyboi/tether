import { randomBytes, randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import type { db as clientDb } from "./client.js";
import { user } from "./schema/auth.js";
import { device } from "./schema/devices.js";
import { fix } from "./schema/fixes.js";
import { invite, membership } from "./schema/membership.js";
import { precisionGrant, precisionRequest } from "./schema/precision.js";
import { room, roomEpoch, roomKeyEnvelope } from "./schema/rooms.js";

type AppDatabase = typeof clientDb;

const APP_TABLES = [
  "precision_grant",
  "precision_request",
  "fix",
  "invite",
  "room_key_envelope",
  "membership",
  "room_epoch",
  "room",
  "device",
];

function assertRow<T>(row: T | undefined) {
  if (!row) {
    throw new Error("insert returned no row");
  }
  return row;
}

export async function truncateAppTables(db: AppDatabase) {
  await db.execute(sql.raw(`TRUNCATE ${APP_TABLES.join(", ")} RESTART IDENTITY CASCADE`));
}

export async function seedUser(db: AppDatabase, overrides: Partial<typeof user.$inferInsert> = {}) {
  const [row] = await db
    .insert(user)
    .values({
      id: randomUUID(),
      name: "test user",
      email: `${randomUUID()}@example.invalid`,
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedDevice(
  db: AppDatabase,
  overrides: Partial<typeof device.$inferInsert> = {},
) {
  const [row] = await db
    .insert(device)
    .values({
      userId: overrides.userId ?? (await seedUser(db)).id,
      identityPublicKey: randomBytes(32),
      platform: "ios",
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedRoom(db: AppDatabase, overrides: Partial<typeof room.$inferInsert> = {}) {
  const [row] = await db
    .insert(room)
    .values({
      ownerId: overrides.ownerId ?? (await seedUser(db)).id,
      nameCiphertext: randomBytes(32),
      nameEpoch: 0,
      precisionPolicy: "approximate_only",
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedEpoch(
  db: AppDatabase,
  overrides: Partial<typeof roomEpoch.$inferInsert> & { roomId: string },
) {
  const [row] = await db
    .insert(roomEpoch)
    .values({
      epoch: 0,
      reason: "created",
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedMembership(
  db: AppDatabase,
  overrides: Partial<typeof membership.$inferInsert> & { roomId: string },
) {
  const [row] = await db
    .insert(membership)
    .values({
      userId: overrides.userId ?? (await seedUser(db)).id,
      memberAlias: overrides.memberAlias ?? randomUUID(),
      displayNameCiphertext: randomBytes(32),
      role: "member",
      joinedEpoch: 0,
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedEnvelope(
  db: AppDatabase,
  overrides: Partial<typeof roomKeyEnvelope.$inferInsert> & {
    roomId: string;
    epoch: number;
    deviceId: string;
  },
) {
  const [row] = await db
    .insert(roomKeyEnvelope)
    .values({
      wrappedKey: randomBytes(32),
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedFix(
  db: AppDatabase,
  overrides: Partial<typeof fix.$inferInsert> & { roomId: string; authorAlias: string },
) {
  const [row] = await db
    .insert(fix)
    .values({
      epoch: 0,
      approximateCiphertext: randomBytes(16),
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedInvite(
  db: AppDatabase,
  overrides: Partial<typeof invite.$inferInsert> & { roomId: string },
) {
  const [row] = await db
    .insert(invite)
    .values({
      tokenHash: randomUUID(),
      grantsRole: "guest",
      wrappedRoomKey: randomBytes(32),
      wrappedRoomKeyEpoch: 0,
      createdBy: overrides.createdBy ?? (await seedUser(db)).id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedPrecisionRequest(
  db: AppDatabase,
  overrides: Partial<typeof precisionRequest.$inferInsert> & {
    roomId: string;
    fromAlias: string;
    toAlias: string;
  },
) {
  const [row] = await db
    .insert(precisionRequest)
    .values({
      status: "pending",
      ...overrides,
    })
    .returning();
  return assertRow(row);
}

export async function seedPrecisionGrant(
  db: AppDatabase,
  overrides: Partial<typeof precisionGrant.$inferInsert> & {
    roomId: string;
    fromAlias: string;
    toAlias: string;
  },
) {
  const [row] = await db
    .insert(precisionGrant)
    .values({
      epoch: 0,
      ratchetIndex: 0,
      ratchetGeneration: 0,
      ...overrides,
    })
    .returning();
  return assertRow(row);
}
