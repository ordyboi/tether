import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";

import { db } from "../db/client.js";
import { env } from "../env.js";
import { SYNTHETIC_NAME, syntheticEmail } from "./synthetic-identity.js";

const googleConfigured = env.GOOGLE_CLIENT_ID.length > 0;
const appleConfigured = env.APPLE_CLIENT_ID.length > 0;

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, { provider: "pg" }),
  advanced: {
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
    ...(googleConfigured && {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    }),
    ...(appleConfigured && {
      apple: {
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET,
        appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
      },
    }),
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
