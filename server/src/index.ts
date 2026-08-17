import fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { db } from "./db/index.ts";
import { env } from "./env.ts";
import { setupErrorHandler } from "./routes/error.ts";
import { registerHealthRoutes } from "./routes/health.ts";
import { registerWsRoutes } from "./routes/ws.ts";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}

const app = fastify({ logger: true });

await app.register(cors, { origin: env.CORS_ORIGIN });
await app.register(websocket);

app.decorate("db", db);

setupErrorHandler(app);
registerWsRoutes(app);
registerHealthRoutes(app);

await app.listen({ host: env.HOST, port: env.PORT }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});