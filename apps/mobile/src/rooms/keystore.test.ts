import { loadRoomKey, storeRoomKey } from "./keystore";

const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

beforeEach(() => {
  mockStore.clear();
});

describe("room keystore", () => {
  it("returns null when nothing is cached", async () => {
    expect(await loadRoomKey("room-1")).toBeNull();
  });

  it("round-trips a stored key and epoch", async () => {
    const key = new Uint8Array(32).fill(9);
    await storeRoomKey("room-1", 3, key);

    const loaded = await loadRoomKey("room-1");

    expect(loaded?.epoch).toBe(3);
    expect(loaded?.key).toEqual(key);
  });

  it("keeps different rooms' keys separate", async () => {
    await storeRoomKey("room-1", 0, new Uint8Array(32).fill(1));
    await storeRoomKey("room-2", 0, new Uint8Array(32).fill(2));

    expect((await loadRoomKey("room-1"))?.key).toEqual(new Uint8Array(32).fill(1));
    expect((await loadRoomKey("room-2"))?.key).toEqual(new Uint8Array(32).fill(2));
  });
});
