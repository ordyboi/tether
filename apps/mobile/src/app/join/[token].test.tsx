import { fireEvent, screen } from "@testing-library/react-native";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("expo-linking", () => ({
  useURL: () => "tether://join/tok123#c2VjcmV0",
}));

const mockConfirm = jest.fn();
const mockUseJoin = jest.fn();
jest.mock("../../data/useJoin", () => ({
  useJoin: (...args: unknown[]) => mockUseJoin(...args),
}));

import { renderWithProviders } from "../../test-utils";
import JoinScreen from "./[token]";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("JoinScreen", () => {
  it("shows the resolving state", async () => {
    mockUseJoin.mockReturnValue({
      phase: "resolving",
      roomId: null,
      error: null,
      confirm: mockConfirm,
    });
    await renderWithProviders(<JoinScreen />);
    expect(screen.getByText("Checking your invite…")).toBeTruthy();
  });

  it("shows the confirm state and fires confirm on tap", async () => {
    mockUseJoin.mockReturnValue({
      phase: "confirm",
      roomId: "room-1",
      error: null,
      confirm: mockConfirm,
    });
    await renderWithProviders(<JoinScreen />);

    expect(screen.getByText("Join this room?")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Join" }));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows the joining state", async () => {
    mockUseJoin.mockReturnValue({
      phase: "joining",
      roomId: "room-1",
      error: null,
      confirm: mockConfirm,
    });
    await renderWithProviders(<JoinScreen />);
    expect(screen.getByText("Joining…")).toBeTruthy();
  });

  it("redirects to the room on success", async () => {
    mockUseJoin.mockReturnValue({
      phase: "success",
      roomId: "room-1",
      error: null,
      confirm: mockConfirm,
    });
    await renderWithProviders(<JoinScreen />);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/room/[roomId]",
      params: { roomId: "room-1" },
    });
  });

  it("shows the error state", async () => {
    mockUseJoin.mockReturnValue({
      phase: "error",
      roomId: null,
      error: "This invite link has expired or already been used.",
      confirm: mockConfirm,
    });
    await renderWithProviders(<JoinScreen />);
    expect(screen.getByText("This invite link has expired or already been used.")).toBeTruthy();
  });
});
