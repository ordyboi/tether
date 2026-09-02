import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../client.js";

const TIMESTAMP_TYPES = ["timestamp without time zone", "timestamp with time zone"];

async function timestampColumns(tableName: string) {
  const result = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = ${tableName}
  `);

  return result.rows
    .filter((row) => TIMESTAMP_TYPES.includes(row.data_type))
    .map((row) => row.column_name)
    .sort();
}

async function hasColumn(tableName: string, columnName: string) {
  const result = await db.execute(sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = ${tableName} AND column_name = ${columnName}
  `);

  return result.rows.length > 0;
}

describe("alias, not user id", () => {
  it.each(["fix", "precision_request", "precision_grant"])("%s has no user_id column", async (tableName) => {
    expect(await hasColumn(tableName, "user_id")).toBe(false);
  });
});

describe("no blanket timestamp mixin", () => {
  const expected: Record<string, string[]> = {
    device: ["created_at", "revoked_at"],
    room: ["created_at", "updated_at"],
    room_epoch: ["created_at"],
    room_key_envelope: ["created_at"],
    membership: ["removed_at"],
    invite: ["created_at", "expires_at", "redeemed_at", "revoked_at"],
    fix: ["server_received_at"],
    precision_request: ["created_at", "responded_at"],
    precision_grant: ["created_at", "expires_at", "revoked_at"],
  };

  it.each(Object.entries(expected))("%s has exactly %j", async (tableName, columns) => {
    expect(await timestampColumns(tableName)).toEqual([...columns].sort());
  });
});
