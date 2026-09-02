import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../client.js";
import { informationSchemaColumns as columns } from "../information-schema.js";
import { seedFix, seedMembership, seedRoom } from "../testing.js";

const TIMESTAMP_TYPES = ["timestamp without time zone", "timestamp with time zone"];

describe("fix schema", () => {
  it("rounds serverReceivedAt to the minute", async () => {
    const room = await seedRoom(db);
    const member = await seedMembership(db, { roomId: room.id });

    const row = await seedFix(db, { roomId: room.id, authorAlias: member.memberAlias });

    expect(row.serverReceivedAt.getUTCSeconds()).toBe(0);
    expect(row.serverReceivedAt.getUTCMilliseconds()).toBe(0);
  });

  it("has exactly one timestamp column and no updated_at", async () => {
    const rows = await db
      .select()
      .from(columns)
      .where(and(eq(columns.tableSchema, "public"), eq(columns.tableName, "fix")));

    const timestampColumns = rows.filter(
      (row) => row.dataType !== null && TIMESTAMP_TYPES.includes(row.dataType),
    );

    expect(timestampColumns.map((row) => row.columnName)).toEqual(["server_received_at"]);
    expect(rows.some((row) => row.columnName === "updated_at")).toBe(false);
  });
});
