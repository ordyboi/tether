const mockUseSession = jest.fn(() => ({ data: null, isPending: false, error: null }));

jest.mock("../auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

import { useSession } from "./useSession";

describe("useSession", () => {
  it("delegates to authClient.useSession", () => {
    const result = useSession();
    expect(mockUseSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: null, isPending: false, error: null });
  });
});
