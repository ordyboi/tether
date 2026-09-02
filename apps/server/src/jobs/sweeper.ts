import { lt, sql } from "drizzle-orm";

import type { db as clientDb } from "../db/client.js";
import { fix } from "../db/schema/fixes.js";
import { invite } from "../db/schema/membership.js";

const FIX_RETENTION_HOURS = 24;

type AppDatabase = typeof clientDb;

export async function runSweeper(db: AppDatabase, now = new Date()) {
  const fixCutoff = new Date(now.getTime() - FIX_RETENTION_HOURS * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    // going through the query builder (rather than binding a raw Date into sql``) is what keeps
    // this UTC: node-postgres serialises a bound Date in the host's local offset, which Postgres
    // then discards when parsing into a `timestamp without time zone` column.
    const invites = await tx.delete(invite).where(lt(invite.expiresAt, now));
    const fixes = await tx.delete(fix).where(lt(fix.serverReceivedAt, fixCutoff));

    // a superseded envelope survives if a fix still needs its epoch, or if the epoch is the
    // room's nameEpoch — either guard missing strands otherwise-readable data (PLAN.md §3).
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
