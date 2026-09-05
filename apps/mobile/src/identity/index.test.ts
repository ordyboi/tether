import { ensureIdentity } from "./index";

const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

function fakeClient(createDevice: jest.Mock) {
  return { createDevice } as unknown as Parameters<typeof ensureIdentity>[0];
}

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe("ensureIdentity", () => {
  it("generates a keypair and registers a device on first run", async () => {
    const createDevice = jest.fn().mockResolvedValue({ id: "device-1" });

    const identity = await ensureIdentity(fakeClient(createDevice));

    expect(identity.deviceId).toBe("device-1");
    expect(identity.secretKey).toHaveLength(32);
    expect(identity.publicKey).toHaveLength(32);
    expect(createDevice).toHaveBeenCalledWith(
      expect.objectContaining({ identityPublicKey: expect.any(String) }),
    );
  });

  it("reuses the stored identity and does not re-register the device", async () => {
    const createDevice = jest.fn().mockResolvedValue({ id: "device-1" });
    const first = await ensureIdentity(fakeClient(createDevice));

    const second = await ensureIdentity(fakeClient(createDevice));

    expect(second.deviceId).toBe(first.deviceId);
    expect(second.publicKey).toEqual(first.publicKey);
    expect(createDevice).toHaveBeenCalledTimes(1);
  });
});
