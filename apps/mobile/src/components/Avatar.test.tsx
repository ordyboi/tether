import { render, screen } from "@testing-library/react-native";

import { Avatar, AvatarStack } from "./Avatar";

describe("Avatar", () => {
  it("renders the initials", async () => {
    await render(<Avatar memberAlias="alice-alias" initials="A" />);
    expect(screen.getByText("A")).toBeTruthy();
  });
});

describe("AvatarStack", () => {
  it("renders every member up to the stacking cap", async () => {
    await render(
      <AvatarStack
        members={[
          { memberAlias: "a", initials: "A" },
          { memberAlias: "b", initials: "B" },
        ]}
      />,
    );
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });

  it("shows an overflow count past the cap", async () => {
    await render(
      <AvatarStack
        members={[
          { memberAlias: "a", initials: "A" },
          { memberAlias: "b", initials: "B" },
          { memberAlias: "c", initials: "C" },
          { memberAlias: "d", initials: "D" },
          { memberAlias: "e", initials: "E" },
        ]}
      />,
    );
    expect(screen.getByText("+1")).toBeTruthy();
  });
});
