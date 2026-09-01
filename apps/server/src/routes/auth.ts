import type { FastifyInstance, FastifyRequest } from "fastify";

import { auth } from "../auth/auth.js";

function toWebRequest(request: FastifyRequest): Request {
  const url = new URL(request.url, `http://${request.headers.host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else if (value) {
      headers.append(key, value);
    }
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody && request.body ? JSON.stringify(request.body) : null,
  });
}

export function authRoutes(app: FastifyInstance): void {
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
