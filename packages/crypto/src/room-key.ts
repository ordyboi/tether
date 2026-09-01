import type { Aead } from "./aead/types.js";
import { concatBytes, utf8ToBytes } from "./bytes.js";
import { encodeFields, stringField, uint64Field } from "./encoding.js";
import { generateIdentityKeyPair, scalarMult } from "./identity.js";
import { hkdfSha256 } from "./kdf.js";
import type { RandomSource } from "./random.js";

export type RoomKey = Uint8Array;

const ROOM_KEY_WRAP_INFO = utf8ToBytes("room-key-wrap");
const EPHEMERAL_PUBLIC_KEY_LENGTH = 32;

export function generateRoomKey(random: RandomSource): RoomKey {
  return random(32);
}

export interface RoomKeyEnvelopeContext {
  readonly roomId: string;
  readonly epoch: number;
  readonly deviceId: string;
}

// Field order here deliberately does not match wrapAad below — this mirrors
// key-management-spec.md §2 exactly (salt = deviceId||roomId||epoch, aad =
// roomId||epoch||deviceId). Do not "fix" the apparent inconsistency: doing so
// changes every wrap key derived and breaks every envelope already written.
function wrapKeySalt(context: RoomKeyEnvelopeContext): Uint8Array {
  return encodeFields([
    stringField(context.deviceId),
    stringField(context.roomId),
    uint64Field(context.epoch),
  ]);
}

function wrapAad(context: RoomKeyEnvelopeContext): Uint8Array {
  return encodeFields([
    stringField(context.roomId),
    uint64Field(context.epoch),
    stringField(context.deviceId),
  ]);
}

export async function wrapRoomKey(
  aead: Aead,
  roomKey: RoomKey,
  recipientPublicKey: Uint8Array,
  context: RoomKeyEnvelopeContext,
  random: RandomSource,
): Promise<Uint8Array> {
  const ephemeral = generateIdentityKeyPair(random);
  const shared = scalarMult(ephemeral.secretKey, recipientPublicKey);
  const wrapKey = hkdfSha256(shared, wrapKeySalt(context), ROOM_KEY_WRAP_INFO, aead.keyLength);
  const sealed = await aead.seal(wrapKey, roomKey, wrapAad(context), random);
  return concatBytes(ephemeral.publicKey, sealed);
}

export async function unwrapRoomKey(
  aead: Aead,
  wrappedKey: Uint8Array,
  deviceSecretKey: Uint8Array,
  context: RoomKeyEnvelopeContext,
): Promise<RoomKey> {
  if (wrappedKey.length < EPHEMERAL_PUBLIC_KEY_LENGTH + aead.keyLength) {
    throw new Error("wrapped room key is truncated");
  }
  const ephemeralPublicKey = wrappedKey.subarray(0, EPHEMERAL_PUBLIC_KEY_LENGTH);
  const sealed = wrappedKey.subarray(EPHEMERAL_PUBLIC_KEY_LENGTH);
  const shared = scalarMult(deviceSecretKey, ephemeralPublicKey);
  const wrapKey = hkdfSha256(shared, wrapKeySalt(context), ROOM_KEY_WRAP_INFO, aead.keyLength);
  return aead.open(wrapKey, sealed, wrapAad(context));
}
