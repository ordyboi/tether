import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

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
