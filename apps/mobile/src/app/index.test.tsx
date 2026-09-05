import { screen } from "@testing-library/react-native";

const mockUseRoom = jest.fn();
jest.mock("../data/useRoom", () => ({
  useRoom: () => mockUseRoom(),
}));

const MockRedirect = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: (props: unknown) => MockRedirect(props),
}));

import { renderWithProviders } from "../test-utils";
import Index from "./index";

beforeEach(() => {
  jest.clearAllMocks();
  MockRedirect.mockReturnValue(null);
});

describe("Index", () => {
  it("shows a loading state before the room resolves", async () => {
    mockUseRoom.mockReturnValue({ room: null, loading: true, error: null });
    await renderWithProviders(<Index />);
    expect(screen.getByText("Setting up your room…")).toBeTruthy();
  });

  it("redirects to the resolved room", async () => {
    mockUseRoom.mockReturnValue({
      room: { roomId: "room-1" },
      loading: false,
      error: null,
    });
    await renderWithProviders(<Index />);
    expect(MockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        href: { pathname: "/room/[roomId]", params: { roomId: "room-1" } },
      }),
    );
  });

  it("shows the error message when bootstrap fails", async () => {
    mockUseRoom.mockReturnValue({ room: null, loading: false, error: new Error("network down") });
    await renderWithProviders(<Index />);
    expect(screen.getByText("network down")).toBeTruthy();
  });
});
