import { randomUUID } from "node:crypto";

import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../db/client.js";
import { invite } from "../db/schema/membership.js";
import { seedInvite, seedRoom } from "../db/testing.js";
import { redis } from "./redis.js";
import { buildSweeperWorker } from "./worker.js";

describe("sweeper worker", () => {
  const queueName = `sweeper-test-${randomUUID()}`;
  let queue: Queue;
  let worker: ReturnType<typeof buildSweeperWorker>;

  beforeEach(() => {
    queue = new Queue(queueName, { connection: redis });
    worker = buildSweeperWorker(redis, queueName);
  });

  afterEach(async () => {
    await worker.close();
    await queue.close();
  });

  it("processes a sweep job through redis and removes expired rows", async () => {
    const room = await seedRoom(db);
    const expired = await seedInvite(db, {
      roomId: room.id,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const completed = new Promise<void>((resolve, reject) => {
      worker.on("completed", () => resolve());
      worker.on("failed", (_job, error) => reject(error));
    });

    await queue.add("sweep", {});
    await completed;

    const rows = await db.select().from(invite).where(eq(invite.id, expired.id));
    expect(rows).toHaveLength(0);
  });
});
