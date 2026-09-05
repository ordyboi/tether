import { render, screen } from "@testing-library/react-native";
import { Text as RNText } from "react-native";

import { Pill } from "./Pill";

describe("Pill", () => {
  it("renders its children", async () => {
    await render(
      <Pill>
        <RNText>2 members</RNText>
      </Pill>,
    );
    expect(screen.getByText("2 members")).toBeTruthy();
  });
});
