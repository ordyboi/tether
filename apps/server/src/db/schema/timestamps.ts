import { timestamp } from "drizzle-orm/pg-core";

export function timestamps() {
  return {
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  };
}
