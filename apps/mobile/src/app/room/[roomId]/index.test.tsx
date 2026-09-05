import { screen, waitFor } from "@testing-library/react-native";

const mockRefresh = jest.fn(() => Promise.resolve());
const mockUseRoom = jest.fn();
jest.mock("../../../data/useRoom", () => ({
  useRoom: () => mockUseRoom(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useFocusEffect: (callback: () => void) => callback(),
}));

import { renderWithProviders } from "../../../test-utils";
import RoomScreen from "./index";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RoomScreen", () => {
  it("shows a loading state before the room resolves", async () => {
    mockUseRoom.mockReturnValue({
      room: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    });

    await renderWithProviders(<RoomScreen />);
    expect(screen.getByText("Setting up your room…")).toBeTruthy();
  });

  it("shows a solo member count for a freshly-created room", async () => {
    mockUseRoom.mockReturnValue({
      room: { roomId: "room-1", currentEpoch: 0, memberAlias: "alias-1", memberCount: 1 },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    await renderWithProviders(<RoomScreen />);
    await waitFor(() => expect(screen.getByText("1 member")).toBeTruthy());
  });

  it("shows a plural member count once someone else has joined", async () => {
    mockUseRoom.mockReturnValue({
      room: { roomId: "room-1", currentEpoch: 1, memberAlias: "alias-1", memberCount: 2 },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    await renderWithProviders(<RoomScreen />);
    await waitFor(() => expect(screen.getByText("2 members")).toBeTruthy());
  });
});
