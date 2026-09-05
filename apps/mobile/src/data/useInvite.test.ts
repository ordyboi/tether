import { renderHook, waitFor } from "@testing-library/react-native";
import type { RoomSummary } from "@tether/api";

import { useInvite } from "./useInvite";

jest.mock("expo-crypto", () => ({
  ...jest.requireActual("expo-crypto"),
  digestStringAsync: jest.fn((_algorithm: string, data: string) =>
    Promise.resolve(require("node:crypto").createHash("sha256").update(data).digest("hex")),
  ),
}));

const mockCreateInvite = jest.fn();
jest.mock("../api/client", () => ({
  tetherClient: { createInvite: (...args: unknown[]) => mockCreateInvite(...args) },
}));

const room = { roomId: "room-1", currentEpoch: 0 } as RoomSummary;
const roomKey = new Uint8Array(32).fill(3);

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateInvite.mockResolvedValue({ id: "invite-1" });
});

describe("useInvite", () => {
  it("creates an invite and returns a tether:// deep link with a fragment", async () => {
    const { result } = await renderHook(() => useInvite(room, roomKey));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockCreateInvite).toHaveBeenCalledTimes(1);
    const [roomId, body] = mockCreateInvite.mock.calls[0];
    expect(roomId).toBe("room-1");
    expect(body.grantsRole).toBe("member");

    expect(result.current.link).toMatch(/^tether:\/\/join\/[0-9a-f]+#[A-Za-z0-9_-]+$/);
    expect(result.current.expiresAt).not.toBeNull();
  });

  it("never puts the invite secret fragment in the create-invite request", async () => {
    const { result } = await renderHook(() => useInvite(room, roomKey));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const fragment = result.current.link!.split("#")[1]!;
    const [, body] = mockCreateInvite.mock.calls[0];
    expect(JSON.stringify(body)).not.toContain(fragment);
  });

  it("stays idle without a room or room key", async () => {
    const { result } = await renderHook(() => useInvite(null, null));
    expect(mockCreateInvite).not.toHaveBeenCalled();
    expect(result.current.link).toBeNull();
  });
});
