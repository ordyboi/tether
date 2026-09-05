describe("tetherClient", () => {
  it("constructs against the configured API URL", () => {
    const { tetherClient } = require("./client") as typeof import("./client");
    expect(typeof tetherClient.listRooms).toBe("function");
  });
});
