import { randomUUID } from "node:crypto";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";

import { db } from "../db/client.js";
import * as schema from "../db/schema/auth.js";
import { env } from "../env.js";

const SYNTHETIC_NAME = "tether user";
const SYNTHETIC_EMAIL_DOMAIN = "stripped.tether.invalid";

function syntheticEmail() {
  return `${randomUUID()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: {
    database: {
      generateId: "uuid",
    },
    ipAddress: {
      disableIpTracking: true,
    },
  },
  account: {
    updateAccountOnSignIn: false,
    accountLinking: {
      enabled: false,
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    apple: {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              name: SYNTHETIC_NAME,
              email: syntheticEmail(),
              image: null,
              emailVerified: false,
            },
          };
        },
      },
    },
    account: {
      create: {
        before: async (account) => {
          return {
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
              accessTokenExpiresAt: null,
              refreshTokenExpiresAt: null,
              scope: null,
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          return {
            data: {
              ...session,
              ipAddress: null,
              userAgent: null,
            },
          };
        },
      },
    },
  },
  plugins: [
    passkey({
      rpID: env.PASSKEY_RP_ID,
      rpName: env.PASSKEY_RP_NAME,
      origin: env.PASSKEY_ORIGIN,
    }),
    anonymous(),
  ],
});
