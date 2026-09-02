import { beforeEach } from "vitest";

import { db } from "./src/db/client.js";
import { truncateAppTables } from "./src/db/testing.js";

beforeEach(async () => {
  await truncateAppTables(db);
});
