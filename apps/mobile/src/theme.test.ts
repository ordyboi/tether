import { avatarColorFor, avatarFont, colors, type } from "./theme";

describe("avatarFont", () => {
  it("scales to 42% of the avatar size, rounded", () => {
    expect(avatarFont(44)).toBe(18);
    expect(avatarFont(36)).toBe(15);
  });
});

describe("avatarColorFor", () => {
  it("is deterministic for the same alias", () => {
    expect(avatarColorFor("alice")).toBe(avatarColorFor("alice"));
  });

  it("picks from the fixed palette", () => {
    expect(colors.avatar).toContain(avatarColorFor("bob"));
  });
});

describe("type scale", () => {
  it("collapses the artboards to seven roles", () => {
    expect(Object.keys(type)).toHaveLength(7);
  });

  it("gives caption an uppercase transform", () => {
    expect(type.caption.textTransform).toBe("uppercase");
  });
});
