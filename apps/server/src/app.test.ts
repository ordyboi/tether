import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { createSignedInUser } from "./auth/session.js";
import { createRoom, registerDevice, type RoomCreateResponse } from "./test-helpers.js";

function captureLogger() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, output: () => chunks.join("") };
}

describe("buildApp logging", () => {
  it("never logs a client IP address or user agent", async () => {
    const { stream, output } = captureLogger();
    const app = buildApp({ loggerStream: stream });

    const clientIp = "203.0.113.42";
    const userAgent = "some-distinctive-test-agent/1.0";

    await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-forwarded-for": clientIp,
        "user-agent": userAgent,
      },
    });

    await app.close();

    expect(output()).not.toContain(clientIp);
    expect(output()).not.toContain(userAgent);
  });
});

describe("error handler", () => {
  it("gives a stale-epoch conflict a { code, message, details } body", async () => {
    const app = buildApp();
    const owner = await createSignedInUser();
    const ownerDevice = await registerDevice(app, owner.cookie);
    const created = await createRoom(app, owner.cookie, ownerDevice.id);
    const { roomId } = created.json<RoomCreateResponse>();

    const token = randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const inviteResponse = await app.inject({
      method: "POST",
      url: `/rooms/${roomId}/invites`,
      headers: { cookie: owner.cookie },
      payload: {
        tokenHash,
        grantsRole: "member",
        wrappedRoomKey: randomBytes(48).toString("base64"),
        wrappedRoomKeyEpoch: 0,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    expect(inviteResponse.statusCode).toBe(201);

    const joiner = await createSignedInUser();
    const joinerDevice = await registerDevice(app, joiner.cookie);

    const response = await app.inject({
      method: "POST",
      url: "/invites/redeem",
      headers: { cookie: joiner.cookie },
      payload: {
        token,
        displayNameCiphertext: randomBytes(16).toString("base64"),
        expectedEpoch: 9,
        nameCiphertext: randomBytes(32).toString("base64"),
        envelopes: [
          { deviceId: ownerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
          { deviceId: joinerDevice.id, wrappedKey: randomBytes(48).toString("base64") },
        ],
      },
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "stale_epoch",
      message: "expectedEpoch does not match room.currentEpoch",
      details: { expectedEpoch: 9, currentEpoch: 0 },
    });
  });

  it("500s an unmapped error with { code: internal } and no driver message", async () => {
    const app = buildApp();
    app.get("/__boom", () => {
      throw new Error("secret driver detail");
    });

    const response = await app.inject({ method: "GET", url: "/__boom" });
    await app.close();

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body).toEqual({ code: "internal", message: "internal server error" });
  });
});

describe("the onRoute error-schema hook", () => {
  it("still round-trips a non-2xx response from /api/auth/*", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/does-not-exist",
    });

    await app.close();

    expect(response.statusCode).not.toBe(500);
    expect(() => response.json()).not.toThrow();
  });
});
