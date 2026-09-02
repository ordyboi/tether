import { SWEEPER_JOB_ID, SWEEPER_JOB_NAME } from "../constants.js";
import { env } from "../env.js";
import { sweeperQueue } from "./queue.js";

export async function registerSweeperSchedule() {
  await sweeperQueue.upsertJobScheduler(
    SWEEPER_JOB_ID,
    { pattern: env.SWEEPER_CRON },
    {
      name: SWEEPER_JOB_NAME,
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    },
  );
}
