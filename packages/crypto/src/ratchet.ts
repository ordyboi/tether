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

export interface RatchetState {
  readonly key: Uint8Array;
  readonly index: number;
  readonly generation: number;
}

// `generation` is the caller's running count across epoch bumps and manual resets
// (0 at room creation); this function only derives the seed for that generation.
export function initRatchet(roomKey: RoomKey, authorAlias: string, generation = 0): RatchetState {
  const salt = encodeFields([stringField(authorAlias)]);
  const key = hkdfSha256(roomKey, salt, RATCHET_INIT_INFO, RATCHET_KEY_LENGTH);
  return { key, index: 0, generation };
}

export function advanceRatchetKey(key: Uint8Array): Uint8Array {
  return hkdfSha256(key, EMPTY_SALT, RATCHET_ADVANCE_INFO, RATCHET_KEY_LENGTH);
}

export function advanceRatchet(state: RatchetState): RatchetState {
  return {
    key: advanceRatchetKey(state.key),
    index: state.index + 1,
    generation: state.generation,
  };
}

export function rerandomizeRatchet(state: RatchetState, random: RandomSource): RatchetState {
  return { key: random(RATCHET_KEY_LENGTH), index: 0, generation: state.generation + 1 };
}

export function deriveRatchetKeyAt(
  grantKey: Uint8Array,
  grantIndex: number,
  targetIndex: number,
): Uint8Array {
  if (targetIndex < grantIndex) {
    throw new Error("cannot derive a ratchet key at an index before the grant");
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

function ratchetAad(context: RatchetSealContext): Uint8Array {
  return encodeFields([
    stringField(context.roomId),
    stringField(context.authorAlias),
    uint64Field(context.epoch),
    uint64Field(context.generation),
    uint64Field(context.index),
  ]);
}

export async function sealRatcheted(
  aead: Aead,
  ratchetKey: Uint8Array,
  plaintext: Uint8Array,
  context: RatchetSealContext,
  random: RandomSource,
): Promise<Uint8Array> {
  return aead.seal(ratchetKey, plaintext, ratchetAad(context), random);
}

export async function openRatcheted(
  aead: Aead,
  ratchetKey: Uint8Array,
  sealed: Uint8Array,
  context: RatchetSealContext,
): Promise<Uint8Array> {
  return aead.open(ratchetKey, sealed, ratchetAad(context));
}
