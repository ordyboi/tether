import { Queue } from "bullmq";

import { connection } from "./connection.js";
import { SWEEPER_QUEUE } from "./queue-name.js";

export const sweeperQueue = new Queue(SWEEPER_QUEUE, { connection });
