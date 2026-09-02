import { bytea, date, snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { devicePlatform } from "./enums.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const device = snakeCase.table("device", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  identityPublicKey: bytea().notNull().unique(),
  pushToken: text(),
  platform: devicePlatform().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  lastSeenAt: date({ mode: "string" }).notNull().$defaultFn(today),
  revokedAt: timestamp(),
});
