import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFastifyApp } from "../src/server.js";

test("GET /health returns ok status", async () => {
  const app = buildFastifyApp();
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
});
