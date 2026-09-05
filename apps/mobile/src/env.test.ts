describe("env", () => {
  const original = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = original;
  });

  it("parses a valid EXPO_PUBLIC_API_URL", () => {
    process.env.EXPO_PUBLIC_API_URL = "http://localhost:3000";
    const { env } = require("./env") as typeof import("./env");
    expect(env.EXPO_PUBLIC_API_URL).toBe("http://localhost:3000");
  });

  it("throws when EXPO_PUBLIC_API_URL is missing", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(() => require("./env")).toThrow();
  });
});
