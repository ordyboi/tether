import { Worker } from "bullmq";
import type { Redis } from "ioredis";

import { SWEEPER_QUEUE } from "../constants.js";
import { db } from "../db/client.js";
import { runSweeper } from "./sweeper.js";

export function buildSweeperWorker(connection: Redis, queueName: string = SWEEPER_QUEUE) {
  return new Worker(
    queueName,
    async () => {
      await runSweeper(db);
    },
    { connection, concurrency: 1 },
  );
}
