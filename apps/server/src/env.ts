import { z } from "zod";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // .env is optional; CI and prod provide real env vars directly
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  TRUSTED_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  APPLE_CLIENT_ID: z.string().min(1),
  APPLE_CLIENT_SECRET: z.string().min(1),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().min(1),
  PASSKEY_RP_ID: z.string().min(1),
  PASSKEY_RP_NAME: z.string().min(1),
  PASSKEY_ORIGIN: z.url(),
  REDIS_URL: z.url(),
  SWEEPER_CRON: z.string().min(1),
});

export const env = envSchema.parse(process.env);
