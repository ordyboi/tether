import {
  bytea,
  foreignKey,
  index,
  integer,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { membership } from "./membership.js";
import { room } from "./rooms.js";

export const fix = snakeCase.table(
  "fix",
  {
    id: uuid().primaryKey().defaultRandom(),
    roomId: uuid()
      .notNull()
      .references(() => room.id),
    epoch: integer().notNull(),
    authorAlias: text().notNull(),
    approximateCiphertext: bytea(),
    preciseCiphertext: bytea(),
    ratchetIndex: integer().notNull().default(0),
    ratchetGeneration: integer().notNull().default(0),
    serverReceivedAt: timestamp()
      .notNull()
      .$defaultFn(() => {
        const now = new Date();
        now.setUTCSeconds(0, 0);
        return now;
      }),
  },
  (table) => [
    foreignKey({
      columns: [table.roomId, table.authorAlias],
      foreignColumns: [membership.roomId, membership.memberAlias],
    }),
    index("fix_room_receivedAt_idx").on(table.roomId, table.serverReceivedAt),
  ],
);
