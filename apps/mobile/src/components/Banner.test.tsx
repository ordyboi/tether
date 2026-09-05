import { render, screen } from "@testing-library/react-native";

import { Banner } from "./Banner";

describe("Banner", () => {
  it("renders the warning message", async () => {
    await render(<Banner message="This link expires in 24 hours." />);
    expect(screen.getByText("This link expires in 24 hours.")).toBeTruthy();
  });
});
