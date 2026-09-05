const mockUseSession = jest.fn();
jest.mock("../data/useSession", () => ({
  useSession: () => mockUseSession(),
}));

interface StackComponent {
  (props: { children?: unknown }): null;
  Screen: () => null;
  Protected: (props: { guard: boolean; children?: unknown }) => unknown;
}

function StackImpl(props: { children?: unknown }) {
  return props.children ?? null;
}
function StackScreen() {
  return null;
}
function StackProtected(props: { guard: boolean; children?: unknown }) {
  return props.guard ? (props.children ?? null) : null;
}

const Stack = StackImpl as StackComponent;
Stack.Screen = StackScreen;
Stack.Protected = StackProtected;

jest.mock("expo-router", () => ({ Stack }));

import { render } from "@testing-library/react-native";

import RootLayout from "./_layout";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RootLayout", () => {
  it("renders nothing while the session is pending", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true });
    const { toJSON } = await render(<RootLayout />);
    expect(toJSON()).toBeNull();
  });

  it("does not throw once the session resolves, signed in or out", async () => {
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    await expect(render(<RootLayout />)).resolves.toBeTruthy();

    mockUseSession.mockReturnValue({ data: null, isPending: false });
    await expect(render(<RootLayout />)).resolves.toBeTruthy();
  });
});
