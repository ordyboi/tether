import { render, screen } from "@testing-library/react-native";
import { Text as RNText } from "react-native";

import { Card } from "./Card";

describe("Card", () => {
  it("renders its children", async () => {
    await render(
      <Card>
        <RNText>Room</RNText>
      </Card>,
    );
    expect(screen.getByText("Room")).toBeTruthy();
  });
});
