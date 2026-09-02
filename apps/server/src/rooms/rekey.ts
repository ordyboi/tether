import { and, eq, isNull, lte } from "drizzle-orm";

import type { db as clientDb } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { membership } from "../db/schema/membership.js";
import { room, roomEpoch, roomKeyEnvelope } from "../db/schema/rooms.js";
import { NotFoundError, StaleEpochError, WrapSetMismatchError } from "./errors.js";

export type AppDatabase = typeof clientDb;
export type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
type EpochReason = (typeof roomEpoch.$inferInsert)["reason"];

export async function listActiveDevices(tx: AppDatabase | Tx, roomId: string, epoch: number) {
  return tx
    .select({ deviceId: device.id, identityPublicKey: device.identityPublicKey })
    .from(device)
    .innerJoin(membership, eq(membership.userId, device.userId))
    .where(
      and(
        eq(membership.roomId, roomId),
        isNull(membership.removedAt),
        lte(membership.joinedEpoch, epoch),
        isNull(device.revokedAt),
      ),
    );
}

export interface EnvelopeInput {
  readonly deviceId: string;
  readonly wrappedKey: Buffer;
}

async function requiredDeviceIds(tx: Tx, roomId: string, newEpoch: number) {
  const rows = await tx
    .select({ id: device.id })
    .from(device)
    .innerJoin(membership, eq(membership.userId, device.userId))
    .where(
      and(
        eq(membership.roomId, roomId),
        isNull(membership.removedAt),
        lte(membership.joinedEpoch, newEpoch),
        isNull(device.revokedAt),
      ),
    );
  return new Set(rows.map((row) => row.id));
}

function validateWrapSet(required: Set<string>, envelopes: EnvelopeInput[]) {
  const submitted = new Set(envelopes.map((envelope) => envelope.deviceId));
  const missing = [...required].filter((id) => !submitted.has(id));
  const extra = [...submitted].filter((id) => !required.has(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new WrapSetMismatchError(missing, extra);
  }
}

async function writeEnvelopes(tx: Tx, roomId: string, epoch: number, envelopes: EnvelopeInput[]) {
  await tx.insert(roomKeyEnvelope).values(
    envelopes.map((envelope) => ({
      roomId,
      epoch,
      deviceId: envelope.deviceId,
      wrappedKey: envelope.wrappedKey,
    })),
  );
}

export interface ApplyRekeyParams {
  readonly roomId: string;
  readonly expectedEpoch: number;
  readonly reason: EpochReason;
  readonly nameCiphertext: Buffer;
  readonly envelopes: EnvelopeInput[];
  mutateMembership(tx: Tx, newEpoch: number): Promise<void>;
}

export interface ApplyRekeyResult {
  readonly newEpoch: number;
}

// Room creation, invite redemption and removal all share this transaction shape with a
// different membership mutation in the middle (step 3). Step 3 must run before step 5's device
// query, because a joiner's `joinedEpoch = newEpoch` or a removal's `removedAt` must already be
// visible for the required-device set to include or exclude them correctly.
//
// Exported separately from `applyRekey` so invite redemption and removal can run it inside a
// transaction that also validates/updates their own rows (the invite, the target membership)
// atomically with the bump — `applyRekey` below is the standalone case with no such wrapper.
export async function runRekey(tx: Tx, params: ApplyRekeyParams): Promise<ApplyRekeyResult> {
  const [roomRow] = await tx.select().from(room).where(eq(room.id, params.roomId)).for("update");
  if (!roomRow) {
    throw new NotFoundError("room not found");
  }
  if (roomRow.currentEpoch !== params.expectedEpoch) {
    throw new StaleEpochError(params.expectedEpoch, roomRow.currentEpoch);
  }
  const newEpoch = roomRow.currentEpoch + 1;

  await params.mutateMembership(tx, newEpoch);

  await tx
    .insert(roomEpoch)
    .values({ roomId: params.roomId, epoch: newEpoch, reason: params.reason });

  const required = await requiredDeviceIds(tx, params.roomId, newEpoch);
  validateWrapSet(required, params.envelopes);
  await writeEnvelopes(tx, params.roomId, newEpoch, params.envelopes);

  await tx
    .update(room)
    .set({ currentEpoch: newEpoch, nameCiphertext: params.nameCiphertext, nameEpoch: newEpoch })
    .where(eq(room.id, params.roomId));

  return { newEpoch };
}

export async function applyRekey(
  db: AppDatabase,
  params: ApplyRekeyParams,
): Promise<ApplyRekeyResult> {
  return db.transaction((tx) => runRekey(tx, params));
}

export interface CreateRoomParams {
  readonly roomId?: string;
  readonly ownerId: string;
  readonly memberAlias: string;
  readonly nameCiphertext: Buffer;
  readonly displayNameCiphertext: Buffer;
  readonly precisionPolicy: (typeof room.$inferInsert)["precisionPolicy"];
  readonly approximateRadiusM?: number;
  readonly envelopes: EnvelopeInput[];
}

const CREATION_EPOCH = 0;

// Room creation has no prior room row to lock and nothing else can race on a room id that does
// not exist yet, so it skips applyRekey's lock-and-compare step but reuses the same
// required-device-set query and wrap-set validation at newEpoch = 0.
export async function createRoom(db: AppDatabase, params: CreateRoomParams) {
  return db.transaction(async (tx) => {
    const [roomRow] = await tx
      .insert(room)
      .values({
        ...(params.roomId === undefined ? {} : { id: params.roomId }),
        ownerId: params.ownerId,
        nameCiphertext: params.nameCiphertext,
        nameEpoch: CREATION_EPOCH,
        precisionPolicy: params.precisionPolicy,
        ...(params.approximateRadiusM === undefined
          ? {}
          : { approximateRadiusM: params.approximateRadiusM }),
        currentEpoch: CREATION_EPOCH,
      })
      .returning();
    if (!roomRow) {
      throw new Error("room insert returned no row");
    }

    await tx
      .insert(roomEpoch)
      .values({ roomId: roomRow.id, epoch: CREATION_EPOCH, reason: "created" });

    await tx.insert(membership).values({
      roomId: roomRow.id,
      userId: params.ownerId,
      memberAlias: params.memberAlias,
      displayNameCiphertext: params.displayNameCiphertext,
      role: "owner",
      joinedEpoch: CREATION_EPOCH,
    });

    const required = await requiredDeviceIds(tx, roomRow.id, CREATION_EPOCH);
    validateWrapSet(required, params.envelopes);
    await writeEnvelopes(tx, roomRow.id, CREATION_EPOCH, params.envelopes);

    return roomRow;
  });
}
