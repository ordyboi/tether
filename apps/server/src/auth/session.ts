import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";

import { UnauthorizedError } from "../errors.js";
import { auth } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function requireSession(request: FastifyRequest) {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!result) {
    throw new UnauthorizedError("unauthorized");
  }
  request.userId = result.user.id;
}

export async function createSignedInUser() {
  const { headers, response } = await auth.api.signInAnonymous({ returnHeaders: true });
  const cookie = headers.get("set-cookie");
  if (!cookie) {
    throw new Error("sign-in-anonymous did not set a session cookie");
  }
  if (!response) {
    throw new Error("sign-in-anonymous returned no response");
  }
  return { userId: response.user.id, cookie };
}
