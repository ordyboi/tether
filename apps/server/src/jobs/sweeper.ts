import { sql } from "drizzle-orm";

import type { db as clientDb } from "../db/client.js";

const FIX_RETENTION_HOURS = 24;

type AppDatabase = typeof clientDb;

export async function runSweeper(db: AppDatabase, now = new Date()) {
  const fixCutoff = new Date(now.getTime() - FIX_RETENTION_HOURS * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    const invites = await tx.execute(sql`
      DELETE FROM invite WHERE expires_at < ${now}
    `);

    const fixes = await tx.execute(sql`
      DELETE FROM fix WHERE server_received_at < ${fixCutoff}
    `);

    const envelopes = await tx.execute(sql`
      DELETE FROM room_key_envelope e
      WHERE EXISTS (SELECT 1 FROM device d
                     WHERE d.id = e.device_id AND d.revoked_at IS NOT NULL)
         OR (
              EXISTS (SELECT 1 FROM room_key_envelope n
                       WHERE n.room_id = e.room_id
                         AND n.device_id = e.device_id
                         AND n.epoch > e.epoch)
          AND NOT EXISTS (SELECT 1 FROM fix f
                           WHERE f.room_id = e.room_id AND f.epoch = e.epoch)
          AND NOT EXISTS (SELECT 1 FROM room r
                           WHERE r.id = e.room_id AND r.name_epoch = e.epoch)
        )
    `);

    return {
      invites: invites.rowCount ?? 0,
      fixes: fixes.rowCount ?? 0,
      envelopes: envelopes.rowCount ?? 0,
    };
  });
}
