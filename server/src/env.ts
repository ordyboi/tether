import { existsSync } from "node:fs";
import { env as environment, exit } from "node:process";
import { z } from "zod";

if (existsSync(".env")) process.loadEnvFile();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOST: z.string(),
  PORT: z.coerce.number().positive(),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.url().default("http://localhost:8081"),
});

const parsed = envSchema.safeParse(environment);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  exit(1);
}

export const env = parsed.data;