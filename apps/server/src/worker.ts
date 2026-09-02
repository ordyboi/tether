import { connection } from "./jobs/connection.js";
import { sweeperQueue } from "./jobs/queue.js";
import { registerSweeperSchedule } from "./jobs/scheduler.js";
import { buildSweeperWorker } from "./jobs/worker.js";

async function main() {
  await registerSweeperSchedule();
  const worker = buildSweeperWorker(connection);

  async function shutdown() {
    await worker.close();
    await sweeperQueue.close();
    connection.disconnect();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
