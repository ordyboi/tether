import { createHash } from "node:crypto";

import { bytesToHex, encodeFields, stringField, uint64Field } from "@tether/crypto";

import { aead, createInviteToken, sealDisplayName, sealRoomName } from "./crypto";

jest.mock("expo-crypto", () => ({
  ...jest.requireActual("expo-crypto"),
  digestStringAsync: jest.fn((_algorithm: string, data: string) =>
    Promise.resolve(require("node:crypto").createHash("sha256").update(data).digest("hex")),
  ),
}));

describe("sealRoomName / sealDisplayName", () => {
  it("round-trips under the matching AAD", async () => {
    const roomKey = new Uint8Array(32).fill(7);
    const sealed = await sealRoomName(roomKey, "room-1", 0, "Home");
    const aad = encodeFields([stringField("room-name"), stringField("room-1"), uint64Field(0)]);
    const opened = await aead.open(roomKey, sealed, aad);
    expect(bytesToHex(opened)).toBe(bytesToHex(new TextEncoder().encode("Home")));
  });

  it("fails to open under a mismatched AAD", async () => {
    const roomKey = new Uint8Array(32).fill(7);
    const sealed = await sealDisplayName(roomKey, "room-1", "device-1", "iPhone");
    const wrongAad = encodeFields([
      stringField("display-name"),
      stringField("room-1"),
      stringField("device-2"),
    ]);
    await expect(aead.open(roomKey, sealed, wrongAad)).rejects.toThrow();
  });
});

describe("createInviteToken", () => {
  it("produces a tokenHash matching the server's sha256 hex digest", async () => {
    const { token, tokenHash } = await createInviteToken();
    expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("generates a different token every call", async () => {
    const first = await createInviteToken();
    const second = await createInviteToken();
    expect(first.token).not.toBe(second.token);
  });
});
