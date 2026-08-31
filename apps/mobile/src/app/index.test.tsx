import { render, screen } from "@testing-library/react-native";

import Index from "./index";

describe("Index", () => {
  it("renders the welcome text", async () => {
    await render(<Index />);

    expect(screen.getByText("Edit src/app/index.tsx to edit this screen.")).toBeTruthy();
  });
});
