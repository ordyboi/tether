import { fireEvent, screen } from "@testing-library/react-native";

import { renderWithProviders } from "../test-utils";

const mockSocial = jest.fn();
const mockPasskey = jest.fn();
const mockAnonymous = jest.fn();
jest.mock("../auth/client", () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) => mockSocial(...args),
      passkey: (...args: unknown[]) => mockPasskey(...args),
      anonymous: (...args: unknown[]) => mockAnonymous(...args),
    },
  },
}));

import SignInScreen from "./sign-in";

beforeEach(() => {
  jest.clearAllMocks();
  mockSocial.mockResolvedValue(undefined);
  mockPasskey.mockResolvedValue(undefined);
  mockAnonymous.mockResolvedValue(undefined);
});

describe("SignInScreen", () => {
  it("signs in with Apple", async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(mockSocial).toHaveBeenCalledWith({ provider: "apple", callbackURL: "tether://" });
  });

  it("signs in with Google", async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(mockSocial).toHaveBeenCalledWith({ provider: "google", callbackURL: "tether://" });
  });

  it("signs in with a passkey", async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue with a passkey" }));
    expect(mockPasskey).toHaveBeenCalledTimes(1);
  });

  it("continues anonymously", async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue without an account" }));
    expect(mockAnonymous).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when a provider fails", async () => {
    mockSocial.mockRejectedValueOnce(new Error("network error"));
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(await screen.findByText("Apple sign-in failed. Try again.")).toBeTruthy();
  });
});
