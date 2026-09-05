import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { act } from "react-test-renderer";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockUseRoom = jest.fn(() => ({
  room: { roomId: "room-1", currentEpoch: 0 },
  roomKey: new Uint8Array(32).fill(1),
}));
jest.mock("../../../data/useRoom", () => ({
  useRoom: () => mockUseRoom(),
}));

const mockUseInvite = jest.fn();
jest.mock("../../../data/useInvite", () => ({
  useInvite: (...args: unknown[]) => mockUseInvite(...args),
}));

const mockSetStringAsync = jest.fn();
jest.mock("expo-clipboard", () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

import { renderWithProviders } from "../../../test-utils";
import ShareScreen from "./share";

beforeEach(() => {
  jest.clearAllMocks();
  mockSetStringAsync.mockResolvedValue(undefined);
});

describe("ShareScreen", () => {
  it("shows a loading state while the invite is being created", async () => {
    mockUseInvite.mockReturnValue({ link: null, expiresAt: null, loading: true, error: null });
    await renderWithProviders(<ShareScreen />);
    expect(screen.getByText("Creating your invite…")).toBeTruthy();
  });

  it("renders the tether:// link and copies it", async () => {
    const link = "tether://join/abc123#c2VjcmV0";
    mockUseInvite.mockReturnValue({
      link,
      expiresAt: new Date().toISOString(),
      loading: false,
      error: null,
    });

    await renderWithProviders(<ShareScreen />);

    expect(screen.getByText(link)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Copy link"));
    });

    await waitFor(() => expect(mockSetStringAsync).toHaveBeenCalledWith(link));
    expect(screen.getByText("Copied")).toBeTruthy();
  });

  it("closes when Done is pressed", async () => {
    mockUseInvite.mockReturnValue({ link: null, expiresAt: null, loading: false, error: null });
    await renderWithProviders(<ShareScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Done" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
