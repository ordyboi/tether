import { Queue } from "bullmq";

import { SWEEPER_QUEUE } from "../constants.js";
import { redis } from "./redis.js";

export const sweeperQueue = new Queue(SWEEPER_QUEUE, { connection: redis });
