import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../client.js";
import { seedMembership, seedPrecisionRequest, seedRoom, truncateAppTables } from "../testing.js";
import { precisionRequest } from "./precision.js";

describe("precision_request pending uniqueness", () => {
  beforeEach(async () => {
    await truncateAppTables(db);
  });

  it("rejects a second pending request for the same pair", async () => {
    const room = await seedRoom(db);
    const from = await seedMembership(db, { roomId: room.id });
    const to = await seedMembership(db, { roomId: room.id });

    await seedPrecisionRequest(db, { roomId: room.id, fromAlias: from.memberAlias, toAlias: to.memberAlias });

    await expect(
      seedPrecisionRequest(db, { roomId: room.id, fromAlias: from.memberAlias, toAlias: to.memberAlias }),
    ).rejects.toThrow();
  });

  it("allows a new pending request once the first is denied", async () => {
    const room = await seedRoom(db);
    const from = await seedMembership(db, { roomId: room.id });
    const to = await seedMembership(db, { roomId: room.id });

    const first = await seedPrecisionRequest(db, {
      roomId: room.id,
      fromAlias: from.memberAlias,
      toAlias: to.memberAlias,
    });

    await db.update(precisionRequest).set({ status: "denied" }).where(eq(precisionRequest.id, first.id));

    await expect(
      seedPrecisionRequest(db, { roomId: room.id, fromAlias: from.memberAlias, toAlias: to.memberAlias }),
    ).resolves.toBeDefined();
  });

  it("allows a pending request for a different pair in the same room", async () => {
    const room = await seedRoom(db);
    const a = await seedMembership(db, { roomId: room.id });
    const b = await seedMembership(db, { roomId: room.id });
    const c = await seedMembership(db, { roomId: room.id });

    await seedPrecisionRequest(db, { roomId: room.id, fromAlias: a.memberAlias, toAlias: b.memberAlias });

    await expect(
      seedPrecisionRequest(db, { roomId: room.id, fromAlias: a.memberAlias, toAlias: c.memberAlias }),
    ).resolves.toBeDefined();
  });
});
