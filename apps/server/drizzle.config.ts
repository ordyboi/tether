import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/auth.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
