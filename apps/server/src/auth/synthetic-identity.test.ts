import { describe, expect, it } from "vitest";

import { syntheticEmail, syntheticName } from "./synthetic-identity.js";

describe("syntheticName", () => {
  it("returns a fixed constant with no per-user distinguishing value", () => {
    expect(syntheticName()).toBe(syntheticName());
    expect(syntheticName()).toBe("tether user");
  });
});

describe("syntheticEmail", () => {
  it("returns a unique address on an unroutable domain each call", () => {
    const first = syntheticEmail();
    const second = syntheticEmail();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}@stripped\.tether\.invalid$/);
    expect(second).toMatch(/^[0-9a-f-]{36}@stripped\.tether\.invalid$/);
  });
});
