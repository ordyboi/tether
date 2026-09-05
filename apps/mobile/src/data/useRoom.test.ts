import { renderHook, waitFor } from "@testing-library/react-native";

import { useRoom } from "./useRoom";

const mockIdentity = {
  deviceId: "device-1",
  secretKey: new Uint8Array(32).fill(1),
  publicKey: new Uint8Array(32).fill(2),
};

const mockEnsureIdentity = jest.fn();
jest.mock("../identity", () => ({
  ensureIdentity: (...args: unknown[]) => mockEnsureIdentity(...args),
}));

const mockListRooms = jest.fn();
const mockCreateRoom = jest.fn();
const mockListEnvelopes = jest.fn();
jest.mock("../api/client", () => ({
  tetherClient: {
    listRooms: (...args: unknown[]) => mockListRooms(...args),
    createRoom: (...args: unknown[]) => mockCreateRoom(...args),
    listEnvelopes: (...args: unknown[]) => mockListEnvelopes(...args),
  },
}));

const mockLoadRoomKey = jest.fn();
const mockStoreRoomKey = jest.fn();
jest.mock("../rooms/keystore", () => ({
  loadRoomKey: (...args: unknown[]) => mockLoadRoomKey(...args),
  storeRoomKey: (...args: unknown[]) => mockStoreRoomKey(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureIdentity.mockResolvedValue(mockIdentity);
  mockListEnvelopes.mockResolvedValue({ envelopes: [] });
  mockLoadRoomKey.mockResolvedValue(null);
  mockStoreRoomKey.mockResolvedValue(undefined);
});

describe("useRoom", () => {
  it("auto-creates a Home room when the caller has none", async () => {
    mockListRooms.mockResolvedValue({ rooms: [] });
    mockCreateRoom.mockResolvedValue({
      roomId: "room-1",
      currentEpoch: 0,
      memberCount: 1,
      role: "owner",
    });

    const { result } = await renderHook(() => useRoom());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockCreateRoom).toHaveBeenCalledTimes(1);
    expect(result.current.room?.roomId).toBe("room-1");
    expect(result.current.deviceId).toBe("device-1");
    expect(mockStoreRoomKey).toHaveBeenCalledWith("room-1", 0, expect.any(Uint8Array));
  });

  it("uses the existing room without creating a second one", async () => {
    mockListRooms.mockResolvedValue({
      rooms: [{ roomId: "room-1", currentEpoch: 0, memberCount: 1, role: "owner" }],
    });
    mockLoadRoomKey.mockResolvedValue({ key: new Uint8Array(32).fill(5), epoch: 0 });

    const { result } = await renderHook(() => useRoom());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockCreateRoom).not.toHaveBeenCalled();
    expect(result.current.roomKey).toEqual(new Uint8Array(32).fill(5));
  });

  it("surfaces errors instead of throwing", async () => {
    mockListRooms.mockRejectedValue(new Error("network down"));

    const { result } = await renderHook(() => useRoom());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error?.message).toBe("network down");
    expect(result.current.room).toBeNull();
  });
});
