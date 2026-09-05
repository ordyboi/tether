import { render, screen } from "@testing-library/react-native";

import { Text } from "./Text";
import { colors, type } from "../theme";

describe("Text", () => {
  it("renders children with the body role by default", async () => {
    await render(<Text>Hello</Text>);
    const node = screen.getByText("Hello");
    expect(node.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: type.body.fontSize })]),
    );
  });

  it("applies the requested role and color", async () => {
    await render(
      <Text role="largeTitle" color={colors.accent}>
        Tether
      </Text>,
    );
    const node = screen.getByText("Tether");
    expect(node.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontSize: type.largeTitle.fontSize, color: colors.accent }),
      ]),
    );
  });
});
