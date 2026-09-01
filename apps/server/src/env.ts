import { z } from "zod";

function splitOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    TRUSTED_ORIGINS: z.string().min(1).transform(splitOrigins),
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    APPLE_CLIENT_ID: z.string().default(""),
    APPLE_CLIENT_SECRET: z.string().default(""),
    APPLE_APP_BUNDLE_IDENTIFIER: z.string().default(""),
    PASSKEY_RP_ID: z.string().min(1),
    PASSKEY_RP_NAME: z.string().min(1),
    PASSKEY_ORIGIN: z.url(),
  })
  .superRefine((value, ctx) => {
    const googleFieldsSet = [value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET].filter(
      (field) => field.length > 0,
    ).length;
    if (googleFieldsSet !== 0 && googleFieldsSet !== 2) {
      ctx.addIssue({
        code: "custom",
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set, or both be blank",
        path: ["GOOGLE_CLIENT_SECRET"],
      });
    }

    const appleFieldsSet = [
      value.APPLE_CLIENT_ID,
      value.APPLE_CLIENT_SECRET,
      value.APPLE_APP_BUNDLE_IDENTIFIER,
    ].filter((field) => field.length > 0).length;
    if (appleFieldsSet !== 0 && appleFieldsSet !== 3) {
      ctx.addIssue({
        code: "custom",
        message:
          "APPLE_CLIENT_ID, APPLE_CLIENT_SECRET and APPLE_APP_BUNDLE_IDENTIFIER must all be set, or all be blank",
        path: ["APPLE_CLIENT_SECRET"],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = loadEnv();
