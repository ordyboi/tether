import { describe, expect, it } from "vitest";

import { defaultRandomSource } from "./random.js";
import { generateRoomKey } from "./room-key.js";
import {
  MAX_RATCHET_SKIP,
  advanceRatchet,
  deriveRatchetKeyAt,
  initRatchet,
  openRatcheted,
  rerandomizeRatchet,
  sealRatcheted,
} from "./ratchet.js";
import { AEADS } from "./test-support/aeads.js";

describe("ratchet key derivation", () => {
  it("advance is deterministic and moves off the current key", () => {
    const roomKey = generateRoomKey(defaultRandomSource);
    const state0 = initRatchet(roomKey, "alice");
    const state1 = advanceRatchet(state0);

    expect(advanceRatchet(state0).key).toEqual(state1.key);
    expect(state1.key).not.toEqual(state0.key);
  });

  it("re-randomization bumps the generation and resets the index", () => {
    const roomKey = generateRoomKey(defaultRandomSource);
    const state0 = initRatchet(roomKey, "alice");
    const state1 = advanceRatchet(state0);

    const reset = rerandomizeRatchet(state1, defaultRandomSource);

    expect(reset.generation).toBe(state1.generation + 1);
    expect(reset.index).toBe(0);
  });

  it("initRatchet derives a different key per generation under the same room key", () => {
    const roomKey = generateRoomKey(defaultRandomSource);

    const generation0 = initRatchet(roomKey, "alice", 0);
    const generation7 = initRatchet(roomKey, "alice", 7);

    expect(generation0.key).not.toEqual(generation7.key);
  });

  it("deriveRatchetKeyAt walks a grant forward to later indices in the same generation", () => {
    const roomKey = generateRoomKey(defaultRandomSource);
    let state = initRatchet(roomKey, "alice");
    state = advanceRatchet(state); // index 1 — grant issued here
    const grantKey = state.key;
    const grantIndex = state.index;

    state = advanceRatchet(state); // index 2
    state = advanceRatchet(state); // index 3

    expect(deriveRatchetKeyAt(grantKey, grantIndex, state.index)).toEqual(state.key);
  });

  it("deriveRatchetKeyAt refuses to derive an earlier index", () => {
    expect(() => deriveRatchetKeyAt(new Uint8Array(32), 3, 1)).toThrow();
  });

  it("deriveRatchetKeyAt refuses a skip beyond MAX_RATCHET_SKIP", () => {
    expect(() => deriveRatchetKeyAt(new Uint8Array(32), 0, MAX_RATCHET_SKIP + 1)).toThrow();
  });
});

describe.each(AEADS)("ratchet seal/open under %s", (_name, aead) => {
  const random = defaultRandomSource;

  it("a grant at index i opens fix i and every later fix in the same generation", async () => {
    const roomKey = generateRoomKey(random);
    let state = initRatchet(roomKey, "alice");
    state = advanceRatchet(state); // index 1
    const grant = { key: state.key, index: state.index, generation: state.generation };

    const contextAt = (index: number) => ({
      roomId: "room-1",
      authorAlias: "alice",
      epoch: 0,
      generation: state.generation,
      index,
    });

    const sealedAtGrant = await sealRatcheted(
      aead,
      state.key,
      new TextEncoder().encode("pos-1"),
      contextAt(1),
      random,
    );

    state = advanceRatchet(state); // index 2
    const sealedLater = await sealRatcheted(
      aead,
      state.key,
      new TextEncoder().encode("pos-2"),
      contextAt(2),
      random,
    );

    const keyAtGrant = deriveRatchetKeyAt(grant.key, grant.index, 1);
    const keyLater = deriveRatchetKeyAt(grant.key, grant.index, 2);

    expect(await openRatcheted(aead, keyAtGrant, sealedAtGrant, contextAt(1))).toEqual(
      new TextEncoder().encode("pos-1"),
    );
    expect(await openRatcheted(aead, keyLater, sealedLater, contextAt(2))).toEqual(
      new TextEncoder().encode("pos-2"),
    );
  });

  it("fails to open a fix sealed at a different index with the wrong context", async () => {
    const roomKey = generateRoomKey(random);
    let state = initRatchet(roomKey, "alice");
    state = advanceRatchet(state); // index 1

    const context = { roomId: "room-1", authorAlias: "alice", epoch: 0, generation: 0, index: 1 };
    const sealed = await sealRatcheted(
      aead,
      state.key,
      new TextEncoder().encode("pos"),
      context,
      random,
    );

    const wrongContext = { ...context, index: 2 };

    await expect(openRatcheted(aead, state.key, sealed, wrongContext)).rejects.toThrow();
  });
});
