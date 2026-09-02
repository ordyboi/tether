import {
  bytea,
  foreignKey,
  integer,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { device } from "./devices.js";
import { epochReason, precisionPolicy } from "./enums.js";
import { timestamps } from "./timestamps.js";

export const room = snakeCase.table("room", {
  id: uuid().primaryKey().defaultRandom(),
  ownerId: text()
    .notNull()
    .references(() => user.id),
  nameCiphertext: bytea().notNull(),
  nameEpoch: integer().notNull(),
  precisionPolicy: precisionPolicy().notNull(),
  approximateRadiusM: integer().notNull().default(500),
  currentEpoch: integer().notNull().default(0),
  ...timestamps(),
});

export const roomEpoch = snakeCase.table(
  "room_epoch",
  {
    roomId: uuid()
      .notNull()
      .references(() => room.id),
    epoch: integer().notNull(),
    reason: epochReason().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.epoch] })],
);

export const roomKeyEnvelope = snakeCase.table(
  "room_key_envelope",
  {
    roomId: uuid().notNull(),
    epoch: integer().notNull(),
    deviceId: uuid()
      .notNull()
      .references(() => device.id),
    wrappedKey: bytea().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.epoch, table.deviceId] }),
    foreignKey({
      columns: [table.roomId, table.epoch],
      foreignColumns: [roomEpoch.roomId, roomEpoch.epoch],
    }),
  ],
);
