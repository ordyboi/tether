import type { Aead } from "./aead/types.js";
import { utf8ToBytes } from "./bytes.js";
import { encodeFields, stringField, uint64Field } from "./encoding.js";
import { hkdfSha256 } from "./kdf.js";
import type { RandomSource } from "./random.js";
import type { RoomKey } from "./room-key.js";

const RATCHET_INIT_INFO = utf8ToBytes("precise-ratchet-init");
const RATCHET_ADVANCE_INFO = utf8ToBytes("precise-ratchet-advance");
const EMPTY_SALT = new Uint8Array(0);
const RATCHET_KEY_LENGTH = 32;
export const MAX_RATCHET_SKIP = 10_000;

export interface RatchetState {
  readonly key: Uint8Array;
  readonly index: number;
  readonly generation: number;
}

export function initRatchet(roomKey: RoomKey, authorAlias: string, generation = 0) {
  const salt = encodeFields([stringField(authorAlias), uint64Field(generation)]);
  const key = hkdfSha256(roomKey, salt, RATCHET_INIT_INFO, RATCHET_KEY_LENGTH);
  return { key, index: 0, generation };
}

export function advanceRatchetKey(key: Uint8Array) {
  return hkdfSha256(key, EMPTY_SALT, RATCHET_ADVANCE_INFO, RATCHET_KEY_LENGTH);
}

export function advanceRatchet(state: RatchetState) {
  return {
    key: advanceRatchetKey(state.key),
    index: state.index + 1,
    generation: state.generation,
  };
}

export function rerandomizeRatchet(state: RatchetState, random: RandomSource) {
  return { key: random(RATCHET_KEY_LENGTH), index: 0, generation: state.generation + 1 };
}

export function deriveRatchetKeyAt(grantKey: Uint8Array, grantIndex: number, targetIndex: number) {
  if (targetIndex < grantIndex) {
    throw new Error("cannot derive a ratchet key at an index before the grant");
  }
  if (targetIndex - grantIndex > MAX_RATCHET_SKIP) {
    throw new Error("ratchet skip exceeds the maximum derivable window");
  }
  let key = grantKey;
  for (let i = grantIndex; i < targetIndex; i++) {
    key = advanceRatchetKey(key);
  }
  return key;
}

export interface RatchetSealContext {
  readonly roomId: string;
  readonly authorAlias: string;
  readonly epoch: number;
  readonly generation: number;
  readonly index: number;
}

export async function sealRatcheted(
  aead: Aead,
  ratchetKey: Uint8Array,
  plaintext: Uint8Array,
  context: RatchetSealContext,
  random: RandomSource,
) {
  const aad = encodeFields([
    stringField(context.roomId),
    stringField(context.authorAlias),
    uint64Field(context.epoch),
    uint64Field(context.generation),
    uint64Field(context.index),
  ]);
  return aead.seal(ratchetKey, plaintext, aad, random);
}

export async function openRatcheted(
  aead: Aead,
  ratchetKey: Uint8Array,
  sealed: Uint8Array,
  context: RatchetSealContext,
) {
  const aad = encodeFields([
    stringField(context.roomId),
    stringField(context.authorAlias),
    uint64Field(context.epoch),
    uint64Field(context.generation),
    uint64Field(context.index),
  ]);
  return aead.open(ratchetKey, sealed, aad);
}
