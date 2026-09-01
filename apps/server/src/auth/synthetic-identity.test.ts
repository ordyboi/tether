import { describe, expect, it } from "vitest";

import { syntheticEmail } from "./synthetic-identity.js";

describe("syntheticEmail", () => {
  it("returns a unique address on an unroutable domain each call", () => {
    const first = syntheticEmail();
    const second = syntheticEmail();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}@stripped\.tether\.invalid$/);
    expect(second).toMatch(/^[0-9a-f-]{36}@stripped\.tether\.invalid$/);
  });
});
