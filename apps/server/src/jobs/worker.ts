import { Worker } from "bullmq";
import type { Redis } from "ioredis";

import { db } from "../db/client.js";
import { runSweeper } from "./sweeper.js";
import { SWEEPER_QUEUE } from "./queue.js";

export function buildSweeperWorker(connection: Redis, queueName: string = SWEEPER_QUEUE) {
  return new Worker(
    queueName,
    async () => {
      await runSweeper(db);
    },
    { connection, concurrency: 1 },
  );
}
