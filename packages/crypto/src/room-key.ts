import type { Aead } from "./aead/types.js";
import { concatBytes, utf8ToBytes } from "./bytes.js";
import { encodeFields, stringField, uint64Field } from "./encoding.js";
import { generateIdentityKeyPair, scalarMult } from "./identity.js";
import { hkdfSha256 } from "./kdf.js";
import type { RandomSource } from "./random.js";

export type RoomKey = Uint8Array;

const ROOM_KEY_WRAP_INFO = utf8ToBytes("room-key-wrap");
const EPHEMERAL_PUBLIC_KEY_LENGTH = 32;

export function generateRoomKey(random: RandomSource) {
  return random(32);
}

export interface RoomKeyEnvelopeContext {
  readonly roomId: string;
  readonly epoch: number;
  readonly deviceId: string;
}

export async function wrapRoomKey(
  aead: Aead,
  roomKey: RoomKey,
  recipientPublicKey: Uint8Array,
  context: RoomKeyEnvelopeContext,
  random: RandomSource,
) {
  const ephemeral = generateIdentityKeyPair(random);
  const shared = scalarMult(ephemeral.secretKey, recipientPublicKey);
  // salt order (deviceId, roomId, epoch) and the aad order below (roomId,
  // epoch, deviceId) both mirror key-management-spec.md §2 exactly and must
  // stay byte-identical with unwrapRoomKey's derivation below, or every
  // envelope already written breaks.
  const salt = encodeFields([
    stringField(context.deviceId),
    stringField(context.roomId),
    uint64Field(context.epoch),
  ]);
  const wrapKey = hkdfSha256(shared, salt, ROOM_KEY_WRAP_INFO, aead.keyLength);
  const aad = encodeFields([
    stringField(context.roomId),
    uint64Field(context.epoch),
    stringField(context.deviceId),
  ]);
  const sealed = await aead.seal(wrapKey, roomKey, aad, random);
  return concatBytes(ephemeral.publicKey, sealed);
}

export async function unwrapRoomKey(
  aead: Aead,
  wrappedKey: Uint8Array,
  deviceSecretKey: Uint8Array,
  context: RoomKeyEnvelopeContext,
) {
  if (wrappedKey.length < EPHEMERAL_PUBLIC_KEY_LENGTH + aead.keyLength) {
    throw new Error("wrapped room key is truncated");
  }
  const ephemeralPublicKey = wrappedKey.subarray(0, EPHEMERAL_PUBLIC_KEY_LENGTH);
  const sealed = wrappedKey.subarray(EPHEMERAL_PUBLIC_KEY_LENGTH);
  const shared = scalarMult(deviceSecretKey, ephemeralPublicKey);
  // Must match wrapRoomKey's salt derivation above exactly.
  const salt = encodeFields([
    stringField(context.deviceId),
    stringField(context.roomId),
    uint64Field(context.epoch),
  ]);
  const wrapKey = hkdfSha256(shared, salt, ROOM_KEY_WRAP_INFO, aead.keyLength);
  // Must match wrapRoomKey's aad derivation above exactly.
  const aad = encodeFields([
    stringField(context.roomId),
    uint64Field(context.epoch),
    stringField(context.deviceId),
  ]);
  return aead.open(wrapKey, sealed, aad);
}
