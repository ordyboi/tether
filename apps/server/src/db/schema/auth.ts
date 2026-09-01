import {
  snakeCase,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = snakeCase.table("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  image: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  isAnonymous: boolean().default(false),
});

export const session = snakeCase.table(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = snakeCase.table(
  "account",
  {
    id: text().primaryKey(),
    issuer: text().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("account_issuer_accountId_uidx").on(table.issuer, table.accountId),
    index("account_userId_idx").on(table.userId),
  ],
);

export const verification = snakeCase.table(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = snakeCase.table(
  "passkey",
  {
    id: text().primaryKey(),
    name: text(),
    publicKey: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text().notNull(),
    counter: integer().notNull(),
    deviceType: text().notNull(),
    backedUp: boolean().notNull(),
    transports: text(),
    createdAt: timestamp(),
    aaguid: text(),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);
