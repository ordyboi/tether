import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../client.js";
import { truncateAppTables } from "../testing.js";

describe("device schema", () => {
  beforeEach(async () => {
    await truncateAppTables(db);
  });

  it("stores lastSeenAt as a date, not a timestamp", async () => {
    const result = await db.execute(sql`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'device' AND column_name = 'last_seen_at'
    `);

    expect(result.rows[0]?.data_type).toBe("date");
  });

  it("has no display_name column", async () => {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'device' AND column_name = 'display_name'
    `);

    expect(result.rows).toHaveLength(0);
  });
});
