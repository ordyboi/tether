import { bytea, integer, snakeCase, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { grantableRole, membershipRole } from "./enums.js";
import { room } from "./rooms.js";

export const membership = snakeCase.table(
  "membership",
  {
    id: uuid().primaryKey().defaultRandom(),
    roomId: uuid()
      .notNull()
      .references(() => room.id),
    userId: text()
      .notNull()
      .references(() => user.id),
    memberAlias: text().notNull(),
    displayNameCiphertext: bytea().notNull(),
    role: membershipRole().notNull(),
    joinedEpoch: integer().notNull(),
    joinedAt: timestamp().defaultNow().notNull(),
    removedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("membership_room_user_uidx").on(table.roomId, table.userId),
    uniqueIndex("membership_room_alias_uidx").on(table.roomId, table.memberAlias),
  ],
);

export const invite = snakeCase.table("invite", {
  id: uuid().primaryKey().defaultRandom(),
  roomId: uuid()
    .notNull()
    .references(() => room.id),
  tokenHash: text().notNull().unique(),
  grantsRole: grantableRole().notNull(),
  wrappedRoomKey: bytea().notNull(),
  wrappedRoomKeyEpoch: integer().notNull(),
  createdBy: text()
    .notNull()
    .references(() => user.id),
  createdAt: timestamp().defaultNow().notNull(),
  expiresAt: timestamp().notNull(),
  redeemedAt: timestamp(),
  revokedAt: timestamp(),
});
