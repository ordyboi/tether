import formbody from "@fastify/formbody";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { auth } from "../auth/auth.js";
import { env } from "../env.js";

const FORM_URLENCODED = "application/x-www-form-urlencoded";

function toUrlEncodedBody(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    params.append(key, String(value));
  }
  return params.toString();
}

function serializeBody(request: FastifyRequest): string | null {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) {
    return null;
  }
  if ((request.headers["content-type"] ?? "").includes(FORM_URLENCODED)) {
    return toUrlEncodedBody(request.body);
  }
  return JSON.stringify(request.body);
}

function toWebRequest(request: FastifyRequest): Request {
  // Apple's OAuth callback POSTs `response_mode=form_post`; every other
  // request Better Auth issues is JSON. Building the URL from BETTER_AUTH_URL
  // rather than the inbound Host header keeps the origin authoritative
  // regardless of what a client claims.
  const url = new URL(request.url, env.BETTER_AUTH_URL);

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else if (value) {
      headers.append(key, value);
    }
  }

  return new Request(url, {
    method: request.method,
    headers,
    body: serializeBody(request),
  });
}

export function authRoutes(app: FastifyInstance): void {
  app.register(formbody);

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: async (request, reply) => {
      const response = await auth.handler(toWebRequest(request));

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.send(response.body ? await response.text() : null);
    },
  });
}
