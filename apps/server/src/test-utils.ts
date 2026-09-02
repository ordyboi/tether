import type { LightMyRequestResponse } from "fastify";

export function json<T>(response: LightMyRequestResponse): T {
  return response.json<T>();
}
