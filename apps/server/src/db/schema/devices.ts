import { sql } from "drizzle-orm";
import { bytea, date, snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { devicePlatform } from "./enums.js";

export const device = snakeCase.table("device", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  identityPublicKey: bytea().notNull().unique(),
  pushToken: text(),
  platform: devicePlatform().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  lastSeenAt: date({ mode: "string" })
    .notNull()
    .default(sql`CURRENT_DATE`),
  revokedAt: timestamp(),
});
