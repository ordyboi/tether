import { randomUUID } from "./random";

describe("randomUUID", () => {
  it("matches the RFC4122 v4 shape", () => {
    const uuid = randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is different every call", () => {
    expect(randomUUID()).not.toBe(randomUUID());
  });
});
