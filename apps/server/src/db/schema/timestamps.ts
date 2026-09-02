import { timestamp } from "drizzle-orm/pg-core";

// for the one table that legitimately needs both createdAt and updatedAt (PRD §7.2 room) — most
// tables here don't, per AGENTS.md's "no blanket timestamp mixin" invariant, so this is opt-in.
export function timestamps() {
  return {
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  };
}
