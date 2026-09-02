import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";

import { auth } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!result) {
    return reply.status(401).send({ error: "unauthorized" });
  }
  request.userId = result.user.id;
}
