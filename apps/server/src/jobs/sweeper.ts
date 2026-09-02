import { and, eq, exists, gt, isNotNull, lt, notExists, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { FIX_RETENTION_HOURS } from "../constants.js";
import type { db as clientDb } from "../db/client.js";
import { device } from "../db/schema/devices.js";
import { fix } from "../db/schema/fixes.js";
import { invite } from "../db/schema/membership.js";
import { room, roomKeyEnvelope } from "../db/schema/rooms.js";

type AppDatabase = typeof clientDb;

export async function runSweeper(db: AppDatabase, now = new Date()) {
  const fixCutoff = new Date(now.getTime() - FIX_RETENTION_HOURS * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    // a bound Date here (rather than a query-builder comparison) would serialise in the host's
    // local offset, which Postgres then discards parsing into a timestamp without time zone
    const invites = await tx.delete(invite).where(lt(invite.expiresAt, now));
    const fixes = await tx.delete(fix).where(lt(fix.serverReceivedAt, fixCutoff));

    const supersedingEnvelope = alias(roomKeyEnvelope, "superseding_envelope");

    // a superseded envelope survives if a fix still needs its epoch, or the epoch is the room's
    // nameEpoch — either guard missing strands otherwise-readable data
    const envelopes = await tx.delete(roomKeyEnvelope).where(
      or(
        exists(
          tx
            .select()
            .from(device)
            .where(and(eq(device.id, roomKeyEnvelope.deviceId), isNotNull(device.revokedAt))),
        ),
        and(
          exists(
            tx
              .select()
              .from(supersedingEnvelope)
              .where(
                and(
                  eq(supersedingEnvelope.roomId, roomKeyEnvelope.roomId),
                  eq(supersedingEnvelope.deviceId, roomKeyEnvelope.deviceId),
                  gt(supersedingEnvelope.epoch, roomKeyEnvelope.epoch),
                ),
              ),
          ),
          notExists(
            tx
              .select()
              .from(fix)
              .where(
                and(eq(fix.roomId, roomKeyEnvelope.roomId), eq(fix.epoch, roomKeyEnvelope.epoch)),
              ),
          ),
          notExists(
            tx
              .select()
              .from(room)
              .where(
                and(eq(room.id, roomKeyEnvelope.roomId), eq(room.nameEpoch, roomKeyEnvelope.epoch)),
              ),
          ),
        ),
      ),
    );

    return {
      invites: invites.rowCount ?? 0,
      fixes: fixes.rowCount ?? 0,
      envelopes: envelopes.rowCount ?? 0,
    };
  });
}
