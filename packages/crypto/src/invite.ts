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

export async function wrapRoomKeyForInvite(
  aead: Aead,
  inviteSecret: Uint8Array,
  roomKey: RoomKey,
  context: InviteWrapContext,
  random: RandomSource,
) {
  const salt = encodeFields([stringField(context.roomId)]);
  const wrapKey = hkdfSha256(inviteSecret, salt, INVITE_KEY_WRAP_INFO, aead.keyLength);
  const aad = encodeFields([
    stringField(context.roomId),
    uint64Field(context.epoch),
    stringField(context.inviteId),
  ]);
  return aead.seal(wrapKey, roomKey, aad, random);
}

export async function unwrapRoomKeyForInvite(
  aead: Aead,
  inviteSecret: Uint8Array,
  wrappedRoomKey: Uint8Array,
  context: InviteWrapContext,
) {
  // Must match wrapRoomKeyForInvite's salt derivation above exactly.
  const salt = encodeFields([stringField(context.roomId)]);
  const wrapKey = hkdfSha256(inviteSecret, salt, INVITE_KEY_WRAP_INFO, aead.keyLength);
  // Must match wrapRoomKeyForInvite's aad derivation above exactly.
  const aad = encodeFields([
    stringField(context.roomId),
    uint64Field(context.epoch),
    stringField(context.inviteId),
  ]);
  return aead.open(wrapKey, wrappedRoomKey, aad);
}
