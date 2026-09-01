import { describe, expect, it } from "vitest";

import { generateIdentityKeyPair } from "./identity.js";
import { defaultRandomSource } from "./random.js";
import { generateRoomKey, unwrapRoomKey, wrapRoomKey } from "./room-key.js";
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

  it("rejects a truncated wrapped key instead of silently misparsing it", async () => {
    const device = generateIdentityKeyPair(random);
    const context = { roomId: "room-1", epoch: 3, deviceId: "device-a" };

    await expect(
      unwrapRoomKey(aead, new Uint8Array(10), device.secretKey, context),
    ).rejects.toThrow("truncated");
  });
});
