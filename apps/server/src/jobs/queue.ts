import { Queue } from "bullmq";

import { connection } from "./connection.js";

export const SWEEPER_QUEUE = "sweeper";

export const sweeperQueue = new Queue(SWEEPER_QUEUE, { connection });
