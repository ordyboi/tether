import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text as RNText } from "react-native";

import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("renders the title and children", async () => {
    await render(
      <Sheet title="Share">
        <RNText>QR code</RNText>
      </Sheet>,
    );
    expect(screen.getByText("Share")).toBeTruthy();
    expect(screen.getByText("QR code")).toBeTruthy();
  });

  it("fires onClose when the close button is tapped", async () => {
    const onClose = jest.fn();
    await render(<Sheet title="Share" onClose={onClose} />);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
