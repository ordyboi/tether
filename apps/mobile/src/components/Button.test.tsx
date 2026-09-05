import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button } from "./Button";

describe("Button", () => {
  it("fires onPress when tapped", async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} />);

    fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress when disabled", async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} disabled />);

    fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
