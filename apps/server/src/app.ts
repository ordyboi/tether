import cors from "@fastify/cors";
import { errorResponseSchema } from "@tether/api";
import Fastify from "fastify";
import { ZodError } from "zod";

import { env } from "./env.js";
import { HttpError } from "./errors.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";
import { envelopeRoutes } from "./routes/envelopes.js";
import { healthRoutes } from "./routes/health.js";
import { inviteRoutes } from "./routes/invites.js";
import { roomRoutes } from "./routes/rooms.js";
import { zodSerializerCompiler, zodValidatorCompiler } from "./zod-type-provider.js";

function zodFieldErrors(error: ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function buildApp(options: { loggerStream?: NodeJS.WritableStream } = {}) {
  const app = Fastify({
    logger: {
      stream: options.loggerStream,
      serializers: {
        req(request) {
          return { method: request.method, url: request.url };
        },
        res(reply) {
          return { statusCode: reply.statusCode };
        },
      },
    },
    disableRequestLogging: true,
    trustProxy: false,
  });

  app.register(cors, { origin: env.TRUSTED_ORIGINS });
  app.decorateRequest("userId", "");
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  // Every declared success schema needs a matching 4xx/5xx schema or fastify silently falls back
  // to raw JSON.stringify on error, which is how an undeclared field would sneak onto the wire.
  // The auth plugin proxies better-auth's own response as a string via reply.send(), which the
  // zod serializer cannot parse, so it's excluded.
  app.addHook("onRoute", (routeOptions) => {
    if (routeOptions.url.startsWith("/api/auth")) return;
    const response = isRecord(routeOptions.schema?.response)
      ? { ...routeOptions.schema.response }
      : {};
    response["4xx"] ??= errorResponseSchema;
    response["5xx"] ??= errorResponseSchema;
    routeOptions.schema = { ...routeOptions.schema, response };
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "invalid_request",
        message: "invalid request body",
        details: { fields: zodFieldErrors(error) },
      });
    }
    if (error instanceof HttpError) {
      return reply
        .status(error.status)
        .send({ code: error.code, message: error.message, details: error.details });
    }
    // Never let a driver/framework error's message reach the client — it can carry SQL, column
    // names or bound parameters (including caller identifiers).
    request.log.error(error);
    return reply.status(500).send({ code: "internal", message: "internal server error" });
  });

  app.register(authRoutes);
  app.register(healthRoutes);
  app.register(deviceRoutes);
  app.register(roomRoutes);
  app.register(envelopeRoutes);
  app.register(inviteRoutes);

  return app;
}
