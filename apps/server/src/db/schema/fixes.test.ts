import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../client.js";
import { truncateAppTables, seedFix, seedMembership, seedRoom } from "../testing.js";

describe("fix schema", () => {
  beforeEach(async () => {
    await truncateAppTables(db);
  });

  it("rounds serverReceivedAt to the minute", async () => {
    const room = await seedRoom(db);
    const member = await seedMembership(db, { roomId: room.id });

    const row = await seedFix(db, { roomId: room.id, authorAlias: member.memberAlias });

    expect(row.serverReceivedAt.getUTCSeconds()).toBe(0);
    expect(row.serverReceivedAt.getUTCMilliseconds()).toBe(0);
  });

  it("has exactly one timestamp column and no updated_at", async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'fix'
    `);

    const timestampColumns = result.rows.filter(
      (row) =>
        row.data_type === "timestamp without time zone" || row.data_type === "timestamp with time zone",
    );

    expect(timestampColumns.map((row) => row.column_name)).toEqual(["server_received_at"]);
    expect(result.rows.some((row) => row.column_name === "updated_at")).toBe(false);
  });
});
