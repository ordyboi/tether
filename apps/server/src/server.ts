import { buildApp } from "./app.js";
import { pool } from "./db/client.js";
import { env } from "./env.js";

const app = buildApp();

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    Promise.all([app.close(), pool.end()])
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error(error);
        process.exit(1);
      });
  });
}
