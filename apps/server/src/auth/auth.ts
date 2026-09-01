import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";

import { db } from "../db/client.js";
import { env, trustedOrigins } from "../env.js";
import { syntheticEmail, syntheticName } from "./synthetic-identity.js";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: trustedOrigins(env.TRUSTED_ORIGINS),
  database: drizzleAdapter(db, { provider: "pg" }),
  advanced: {
    ipAddress: {
      disableIpTracking: true,
    },
  },
  user: {
    changeEmail: {
      enabled: false,
    },
    additionalFields: {
      name: {
        type: "string",
        required: true,
        input: false,
        sortable: true,
        fieldName: "name",
        defaultValue: syntheticName,
      },
      email: {
        type: "string",
        required: true,
        unique: true,
        input: false,
        sortable: true,
        fieldName: "email",
        defaultValue: syntheticEmail,
      },
      image: {
        type: "string",
        required: false,
        input: false,
        fieldName: "image",
      },
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
      mapProfileToUser: () => ({
        name: syntheticName(),
        email: syntheticEmail(),
      }),
    },
    apple: {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
      mapProfileToUser: () => ({
        name: syntheticName(),
        email: syntheticEmail(),
      }),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              name: syntheticName(),
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
