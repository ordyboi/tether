import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../client.js";
import { informationSchemaColumns as columns } from "../information-schema.js";

function deviceColumn(columnName: string) {
  return db
    .select()
    .from(columns)
    .where(
      and(
        eq(columns.tableSchema, "public"),
        eq(columns.tableName, "device"),
        eq(columns.columnName, columnName),
      ),
    );
}

describe("device schema", () => {
  it("stores lastSeenAt as a date, not a timestamp", async () => {
    const [column] = await deviceColumn("last_seen_at");
    expect(column?.dataType).toBe("date");
  });

  it("has no display_name column", async () => {
    expect(await deviceColumn("display_name")).toHaveLength(0);
  });
});
