import { describe, expect, it } from "vitest";

import { unwrapRoomKeyForInvite, wrapRoomKeyForInvite } from "./invite.js";
import { defaultRandomSource } from "./random.js";
import { generateRoomKey } from "./room-key.js";
import { AEADS } from "./test-support/aeads.js";

describe.each(AEADS)("invite-secret wrap/unwrap under %s", (_name, aead) => {
  const random = defaultRandomSource;

  it("round-trips a room key from an invite secret", async () => {
    const inviteSecret = random(32);
    const roomKey = generateRoomKey(random);
    const context = { roomId: "room-1", epoch: 0, inviteId: "invite-1" };

    const wrapped = await wrapRoomKeyForInvite(aead, inviteSecret, roomKey, context, random);
    const opened = await unwrapRoomKeyForInvite(aead, inviteSecret, wrapped, context);

    expect(opened).toEqual(roomKey);
  });

  it("fails to open with the wrong invite secret", async () => {
    const inviteSecret = random(32);
    const wrongSecret = random(32);
    const roomKey = generateRoomKey(random);
    const context = { roomId: "room-1", epoch: 0, inviteId: "invite-1" };

    const wrapped = await wrapRoomKeyForInvite(aead, inviteSecret, roomKey, context, random);

    await expect(unwrapRoomKeyForInvite(aead, wrongSecret, wrapped, context)).rejects.toThrow();
  });
});
