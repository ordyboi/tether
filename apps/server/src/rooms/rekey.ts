import { and, eq, isNull, lte } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { invite, membership } from "../db/schema/membership.js";
import { room, roomEpoch, roomKeyEnvelope } from "../db/schema/rooms.js";
import {
  NotFoundError,
  RoomExistsError,
  StaleEpochError,
  WrapSetMismatchError,
} from "../errors.js";

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
  const rows = await listActiveDevices(tx, roomId, newEpoch);
  return new Set(rows.map((row) => row.deviceId));
}

function findDuplicates(ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function validateWrapSet(required: Set<string>, envelopes: EnvelopeInput[]) {
  const submittedIds = envelopes.map((envelope) => envelope.deviceId);
  const duplicates = findDuplicates(submittedIds);
  if (duplicates.length > 0) {
    throw new WrapSetMismatchError([], [], duplicates);
  }
  const submitted = new Set(submittedIds);
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

// An invite's wrappedRoomKey goes stale on rekey, so every bump revokes what's still outstanding.
async function revokeOutstandingInvites(tx: Tx, roomId: string) {
  await tx
    .update(invite)
    .set({ revokedAt: new Date() })
    .where(and(eq(invite.roomId, roomId), isNull(invite.redeemedAt), isNull(invite.revokedAt)));
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

// The membership mutation must run before the device-set query below, or a joiner/removal isn't reflected in it yet.
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

  await revokeOutstandingInvites(tx, params.roomId);

  return { newEpoch };
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

// No room row exists yet to lock, so this skips runRekey's lock-and-compare step.
export async function createRoom(db: AppDatabase, params: CreateRoomParams) {
  return db.transaction(async (tx) => {
    if (params.roomId !== undefined) {
      const [existing] = await tx
        .select({ id: room.id })
        .from(room)
        .where(eq(room.id, params.roomId));
      if (existing) {
        throw new RoomExistsError();
      }
    }

    const [roomRow] = await tx
      .insert(room)
      .values({
        id: params.roomId,
        ownerId: params.ownerId,
        nameCiphertext: params.nameCiphertext,
        nameEpoch: CREATION_EPOCH,
        precisionPolicy: params.precisionPolicy,
        approximateRadiusM: params.approximateRadiusM,
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
