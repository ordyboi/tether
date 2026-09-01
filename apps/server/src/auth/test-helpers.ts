import { sql } from "drizzle-orm";

import { db } from "../db/client.js";

export async function truncateAuthTables(): Promise<void> {
  await db.execute(
    sql`truncate table "user", "session", "account", "verification", "passkey" cascade`,
  );
}
