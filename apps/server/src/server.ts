import { buildApp } from "./app.js";
import { pool } from "./db/client.js";
import { env } from "./env.js";

const app = buildApp();

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

async function shutdown() {
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
