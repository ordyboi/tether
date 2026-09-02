import { sql } from "drizzle-orm";
import {
  foreignKey,
  integer,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { requestStatus } from "./enums.js";
import { membership } from "./membership.js";
import { room } from "./rooms.js";

export const precisionRequest = snakeCase.table(
  "precision_request",
  {
    id: uuid().primaryKey().defaultRandom(),
    roomId: uuid()
      .notNull()
      .references(() => room.id),
    fromAlias: text().notNull(),
    toAlias: text().notNull(),
    status: requestStatus().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    respondedAt: timestamp(),
  },
  (table) => [
    foreignKey({
      columns: [table.roomId, table.fromAlias],
      foreignColumns: [membership.roomId, membership.memberAlias],
    }),
    foreignKey({
      columns: [table.roomId, table.toAlias],
      foreignColumns: [membership.roomId, membership.memberAlias],
    }),
    uniqueIndex("precision_request_pending_uidx")
      .on(table.roomId, table.fromAlias, table.toAlias)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const precisionGrant = snakeCase.table(
  "precision_grant",
  {
    id: uuid().primaryKey().defaultRandom(),
    roomId: uuid()
      .notNull()
      .references(() => room.id),
    fromAlias: text().notNull(),
    toAlias: text().notNull(),
    epoch: integer().notNull(),
    ratchetIndex: integer().notNull(),
    ratchetGeneration: integer().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    expiresAt: timestamp(),
    revokedAt: timestamp(),
  },
  (table) => [
    foreignKey({
      columns: [table.roomId, table.fromAlias],
      foreignColumns: [membership.roomId, membership.memberAlias],
    }),
    foreignKey({
      columns: [table.roomId, table.toAlias],
      foreignColumns: [membership.roomId, membership.memberAlias],
    }),
  ],
);
