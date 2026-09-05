import { fireEvent, render, screen } from "@testing-library/react-native";

import { ListRow } from "./ListRow";

describe("ListRow", () => {
  it("renders title and subtitle", async () => {
    await render(<ListRow title="Home" subtitle="2 members" />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("2 members")).toBeTruthy();
  });

  it("fires onPress when tapped", async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Home" onPress={onPress} />);
    fireEvent.press(screen.getByText("Home"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
