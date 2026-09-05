import { renderHook, waitFor } from "@testing-library/react-native";
import { TetherApiError } from "@tether/api/client";
import { generateRoomKey, wrapRoomKeyForInvite } from "@tether/crypto";
import { act } from "react-test-renderer";

import { encodeBase64, encodeBase64Url } from "../base64";
import { random } from "../random";
import { aead } from "../rooms/crypto";
import { parseJoinUrl, useJoin } from "./useJoin";

const mockIdentity = {
  deviceId: "device-2",
  secretKey: new Uint8Array(32).fill(4),
  publicKey: new Uint8Array(32).fill(5),
};
jest.mock("../identity", () => ({
  ensureIdentity: () => Promise.resolve(mockIdentity),
}));

const mockLookupInvite = jest.fn();
const mockListRoomDevices = jest.fn();
const mockRedeemInvite = jest.fn();
jest.mock("../api/client", () => ({
  tetherClient: {
    lookupInvite: (...args: unknown[]) => mockLookupInvite(...args),
    listRoomDevices: (...args: unknown[]) => mockListRoomDevices(...args),
    redeemInvite: (...args: unknown[]) => mockRedeemInvite(...args),
  },
}));

const mockStoreRoomKey = jest.fn();
jest.mock("../rooms/keystore", () => ({
  storeRoomKey: (...args: unknown[]) => mockStoreRoomKey(...args),
}));

const ROOM_ID = "room-1";
const INVITE_ID = "invite-1";

async function buildLinkAndLookup(epoch = 0) {
  const inviteSecret = random(32);
  const roomKey = generateRoomKey(random);
  const wrapped = await wrapRoomKeyForInvite(
    aead,
    inviteSecret,
    roomKey,
    { roomId: ROOM_ID, epoch, inviteId: INVITE_ID },
    random,
  );
  const url = `tether://join/tok123#${encodeBase64Url(inviteSecret)}`;
  const lookup = {
    id: INVITE_ID,
    roomId: ROOM_ID,
    grantsRole: "member" as const,
    wrappedRoomKey: encodeBase64(wrapped),
    wrappedRoomKeyEpoch: epoch,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  return { url, lookup };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parseJoinUrl", () => {
  it("splits the token and fragment", () => {
    const parsed = parseJoinUrl("tether://join/abc123#c2VjcmV0");
    expect(parsed?.token).toBe("abc123");
  });

  it("returns null without a fragment", () => {
    expect(parseJoinUrl("tether://join/abc123")).toBeNull();
  });
});

describe("useJoin", () => {
  it("goes resolving -> confirm on a valid link", async () => {
    const { url, lookup } = await buildLinkAndLookup();
    mockLookupInvite.mockResolvedValue(lookup);

    const { result } = await renderHook(() => useJoin(url));

    await waitFor(() => expect(result.current.phase).toBe("confirm"));
    expect(result.current.roomId).toBe(ROOM_ID);
  });

  it("errors on a broken link", async () => {
    const { result } = await renderHook(() => useJoin("tether://join/no-fragment"));
    await waitFor(() => expect(result.current.phase).toBe("error"));
  });

  it("errors when the invite lookup 404s", async () => {
    const { url } = await buildLinkAndLookup();
    mockLookupInvite.mockRejectedValue(new TetherApiError(404, { code: "not_found" }));

    const { result } = await renderHook(() => useJoin(url));

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error).toMatch(/expired or already been used/);
  });

  it("joins successfully through confirm, wrapping the new key for every device", async () => {
    const { url, lookup } = await buildLinkAndLookup();
    mockLookupInvite.mockResolvedValue(lookup);
    mockListRoomDevices.mockResolvedValue({
      epoch: 0,
      devices: [
        { deviceId: "device-1", identityPublicKey: encodeBase64(new Uint8Array(32).fill(9)) },
      ],
    });
    mockRedeemInvite.mockResolvedValue({ roomId: ROOM_ID, newEpoch: 1, memberAlias: "alias-1" });

    const { result } = await renderHook(() => useJoin(url));
    await waitFor(() => expect(result.current.phase).toBe("confirm"));

    await act(async () => {
      result.current.confirm();
    });
    await waitFor(() => expect(result.current.phase).toBe("success"));

    const [payload] = mockRedeemInvite.mock.calls[0] as [{ envelopes: { deviceId: string }[] }];
    const deviceIds = payload.envelopes.map((envelope) => envelope.deviceId).sort();
    expect(deviceIds).toEqual(["device-1", "device-2"]);
    expect(mockStoreRoomKey).toHaveBeenCalledWith(ROOM_ID, 1, expect.any(Uint8Array));
  });

  it("retries once on a stale_epoch conflict", async () => {
    const { url, lookup } = await buildLinkAndLookup();
    mockLookupInvite.mockResolvedValue(lookup);
    mockListRoomDevices.mockResolvedValue({ epoch: 0, devices: [] });

    mockRedeemInvite
      .mockRejectedValueOnce(new TetherApiError(409, { code: "stale_epoch" }))
      .mockResolvedValueOnce({ roomId: ROOM_ID, newEpoch: 2, memberAlias: "alias-1" });

    const { result } = await renderHook(() => useJoin(url));
    await waitFor(() => expect(result.current.phase).toBe("confirm"));

    await act(async () => {
      result.current.confirm();
    });
    await waitFor(() => expect(result.current.phase).toBe("success"));

    expect(mockRedeemInvite).toHaveBeenCalledTimes(2);
  });

  it("surfaces an already_member conflict as a friendly message", async () => {
    const { url, lookup } = await buildLinkAndLookup();
    mockLookupInvite.mockResolvedValue(lookup);
    mockListRoomDevices.mockResolvedValue({ epoch: 0, devices: [] });

    mockRedeemInvite.mockRejectedValue(new TetherApiError(409, { code: "already_member" }));

    const { result } = await renderHook(() => useJoin(url));
    await waitFor(() => expect(result.current.phase).toBe("confirm"));

    await act(async () => {
      result.current.confirm();
    });
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error).toMatch(/already a member/);
  });
});
