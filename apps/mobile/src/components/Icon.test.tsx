import { render, screen } from "@testing-library/react-native";

import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders the requested symbol", async () => {
    await render(<Icon name="chevronLeft" />);
    expect(screen.getByTestId("icon-chevronLeft")).toBeTruthy();
  });
});
