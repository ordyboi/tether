import { buildApp } from "./app.js";

const app = buildApp();

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
