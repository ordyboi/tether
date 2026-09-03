import { describe, expect, it, vi } from "vitest";

import { createTetherClient, TetherApiError } from "./index.js";

function fakeFetch(response: { status: number; body: unknown }) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  });
}

function fakeRawFetch(response: { status: number; body: string }) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(response.body === "" ? null : response.body, { status: response.status }),
  );
}

describe("createTetherClient", () => {
  it("joins baseUrl and path, sends JSON, and merges async headers", async () => {
    const fetch = fakeFetch({ status: 200, body: { rooms: [] } });
    const client = createTetherClient({
      baseUrl: "https://api.example.com",
      fetch,
      headers: async () => ({ cookie: "session=abc" }),
    });

    await client.listRooms();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.example.com/rooms");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toMatchObject({ cookie: "session=abc" });
  });

  it("sends a JSON body and content-type on POST", async () => {
    const fetch = fakeFetch({ status: 201, body: { id: "device-1" } });
    const client = createTetherClient({ baseUrl: "https://api.example.com", fetch });

    await client.createDevice({ identityPublicKey: "a".repeat(44), platform: "ios" });

    const [, init] = fetch.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      identityPublicKey: "a".repeat(44),
      platform: "ios",
    });
  });

  it("throws TetherApiError carrying status and body on a non-2xx response", async () => {
    const fetch = fakeFetch({ status: 404, body: { error: "not found" } });
    const client = createTetherClient({ baseUrl: "https://api.example.com", fetch });

    await expect(client.listRooms()).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof TetherApiError)) return false;
      expect(error.status).toBe(404);
      expect(error.body).toEqual({ error: "not found" });
      return true;
    });
  });

  it("throws TetherApiError with the status on an empty non-JSON error body", async () => {
    const fetch = fakeRawFetch({ status: 401, body: "" });
    const client = createTetherClient({ baseUrl: "https://api.example.com", fetch });

    await expect(client.listRooms()).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof TetherApiError)) return false;
      expect(error.status).toBe(401);
      return true;
    });
  });

  it("throws TetherApiError with the status on an HTML gateway error body", async () => {
    const fetch = fakeRawFetch({ status: 502, body: "<html>502</html>" });
    const client = createTetherClient({ baseUrl: "https://api.example.com", fetch });

    await expect(client.listRooms()).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof TetherApiError)) return false;
      expect(error.status).toBe(502);
      expect(error.body).toBe("<html>502</html>");
      return true;
    });
  });

  it("resolves rather than throwing on a 204 with an empty body", async () => {
    const fetch = fakeRawFetch({ status: 204, body: "" });
    const client = createTetherClient({ baseUrl: "https://api.example.com", fetch });

    await expect(client.listRooms()).resolves.toBeUndefined();
  });
});
