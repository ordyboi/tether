import type { Aead } from "./aead/types.js";
import { utf8ToBytes } from "./bytes.js";
import { encodeFields, stringField, uint64Field } from "./encoding.js";
import { hkdfSha256 } from "./kdf.js";
import type { RandomSource } from "./random.js";
import type { RoomKey } from "./room-key.js";

const INVITE_KEY_WRAP_INFO = utf8ToBytes("invite-key-wrap");

export interface InviteWrapContext {
  readonly roomId: string;
  readonly epoch: number;
  readonly inviteId: string;
}

function inviteWrapKey(aead: Aead, inviteSecret: Uint8Array, roomId: string): Uint8Array {
  const salt = encodeFields([stringField(roomId)]);
  return hkdfSha256(inviteSecret, salt, INVITE_KEY_WRAP_INFO, aead.keyLength);
}

function inviteAad(context: InviteWrapContext): Uint8Array {
  return encodeFields([
    stringField(context.roomId),
    uint64Field(context.epoch),
    stringField(context.inviteId),
  ]);
}

export async function wrapRoomKeyForInvite(
  aead: Aead,
  inviteSecret: Uint8Array,
  roomKey: RoomKey,
  context: InviteWrapContext,
  random: RandomSource,
): Promise<Uint8Array> {
  const wrapKey = inviteWrapKey(aead, inviteSecret, context.roomId);
  return aead.seal(wrapKey, roomKey, inviteAad(context), random);
}

export async function unwrapRoomKeyForInvite(
  aead: Aead,
  inviteSecret: Uint8Array,
  wrappedRoomKey: Uint8Array,
  context: InviteWrapContext,
): Promise<RoomKey> {
  const wrapKey = inviteWrapKey(aead, inviteSecret, context.roomId);
  return aead.open(wrapKey, wrappedRoomKey, inviteAad(context));
}
