import { describe, expect, it } from "vitest";

import { generateIdentityKeyPair } from "./identity.js";
import { defaultRandomSource } from "./random.js";
import {
  generateRoomKey,
  openUnderRoomKey,
  sealUnderRoomKey,
  unwrapRoomKey,
  wrapRoomKey,
} from "./room-key.js";
import { AEADS } from "./test-support/aeads.js";

describe.each(AEADS)("room-key wrap/unwrap under %s", (_name, aead) => {
  const random = defaultRandomSource;

  it("round-trips a wrapped room key to its intended device", async () => {
    const device = generateIdentityKeyPair(random);
    const roomKey = generateRoomKey(random);
    const context = { roomId: "room-1", epoch: 3, deviceId: "device-a" };

    const wrapped = await wrapRoomKey(aead, roomKey, device.publicKey, context, random);
    const opened = await unwrapRoomKey(aead, wrapped, device.secretKey, context);

    expect(opened).toEqual(roomKey);
  });

  it("fails to open with the wrong device's secret key", async () => {
    const device = generateIdentityKeyPair(random);
    const otherDevice = generateIdentityKeyPair(random);
    const roomKey = generateRoomKey(random);
    const context = { roomId: "room-1", epoch: 3, deviceId: "device-a" };

    const wrapped = await wrapRoomKey(aead, roomKey, device.publicKey, context, random);

    await expect(unwrapRoomKey(aead, wrapped, otherDevice.secretKey, context)).rejects.toThrow();
  });

  it("fails to open when the epoch in the AAD does not match the wrap", async () => {
    const device = generateIdentityKeyPair(random);
    const roomKey = generateRoomKey(random);
    const wrapContext = { roomId: "room-1", epoch: 3, deviceId: "device-a" };
    const openContext = { ...wrapContext, epoch: 4 };

    const wrapped = await wrapRoomKey(aead, roomKey, device.publicKey, wrapContext, random);

    await expect(unwrapRoomKey(aead, wrapped, device.secretKey, openContext)).rejects.toThrow();
  });

  it("generates independent keys across epochs", () => {
    const first = generateRoomKey(random);
    const second = generateRoomKey(random);

    expect(first).not.toEqual(second);
  });

  it("seals and opens arbitrary plaintext directly under the room key (e.g. room name)", async () => {
    const roomKey = generateRoomKey(random);
    const aad = new Uint8Array([1, 2, 3]);
    const plaintext = new TextEncoder().encode("The Smiths");

    const sealed = await sealUnderRoomKey(aead, roomKey, plaintext, aad, random);
    const opened = await openUnderRoomKey(aead, roomKey, sealed, aad);

    expect(opened).toEqual(plaintext);
  });
});
