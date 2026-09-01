import { describe, expect, it } from "vitest";

import { defaultRandomSource } from "./random.js";
import { generateRoomKey } from "./room-key.js";
import {
  advanceRatchet,
  deriveRatchetKeyAt,
  initRatchet,
  openRatcheted,
  rerandomizeRatchet,
  sealRatcheted,
} from "./ratchet.js";
import { AEADS } from "./test-support/aeads.js";

describe("ratchet key derivation", () => {
  it("advance is one-way: the previous key cannot be recovered from the next", () => {
    const roomKey = generateRoomKey(defaultRandomSource);
    const state0 = initRatchet(roomKey, "alice");
    const state1 = advanceRatchet(state0);

    // Deriving forward from state0 lands on state1's key...
    expect(advanceRatchet(state0).key).toEqual(state1.key);
    // ...but there is no inverse of advanceRatchet to walk state1 back to state0.
    expect(state1.key).not.toEqual(state0.key);
  });

  it("re-randomization is not derived from the prior chain and bumps the generation", () => {
    const roomKey = generateRoomKey(defaultRandomSource);
    const state0 = initRatchet(roomKey, "alice");
    const state1 = advanceRatchet(state0);

    const reset = rerandomizeRatchet(state1, defaultRandomSource);

    expect(reset.generation).toBe(state1.generation + 1);
    expect(reset.index).toBe(0);
    expect(reset.key).not.toEqual(state1.key);
    expect(reset.key).not.toEqual(advanceRatchetKeyOf(state1));
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

  function advanceRatchetKeyOf(state: ReturnType<typeof initRatchet>) {
    return advanceRatchet(state).key;
  }
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
