# Review findings — PR #29 (Phase 4: schema and sweeper)

Reviewed against PLAN.md, PRD §4/§6.3/§6.6/§7.2/§7.3/§7.4/§9, `docs/key-management-spec.md`,
`docs/threat-model.md` and the AGENTS.md invariants.

The schema is faithful to the plan and the partial unique index, the alias-not-user-id
invariant, the single rounded `fix` timestamp and both envelope-retention guards are all real
and covered by tests. Everything below is what survived an adversarial pass.

Findings are ordered by severity. Each one says how it was verified, so nothing here needs to be
taken on trust.

---

## 1. HIGH — `runSweeper` compares timestamps in the host's local timezone, not UTC

`apps/server/src/jobs/sweeper.ts:14` and `:18`

Both deletes bind a JavaScript `Date` straight into a raw SQL template:

```ts
DELETE FROM invite WHERE expires_at < ${now}
DELETE FROM fix WHERE server_received_at < ${fixCutoff}
```

A bound `Date` does not go through drizzle's column mapper — it goes through node-postgres's
`prepareValue`, which serialises **local time with an offset**:

| `TZ` | `prepareValue(new Date('2026-07-01T12:00:00Z'))` |
|---|---|
| `UTC` | `2026-07-01T12:00:00.000+00:00` |
| `Europe/London` | `2026-07-01T13:00:00.000+01:00` |
| `America/New_York` | `2026-07-01T08:00:00.000-04:00` |

Postgres **discards the offset** when parsing into `timestamp without time zone`:

```
SELECT '2026-07-01T13:00:00.000+01:00'::timestamp;  -->  2026-07-01 13:00:00
```

Meanwhile the stored values are UTC wall clock, because drizzle's `PgTimestamp.mapToDriverValue`
uses `value.toISOString()` on the insert path. So the comparison value is shifted by the host's
UTC offset while the column values are not.

**Verified by running the existing test suite under different timezones** against a real
Postgres 17:

```
TZ=UTC               Tests 20 passed
TZ=America/New_York  Tests  1 failed | 19 passed

AssertionError: expected { … } to deeply equal { invites: 1, fixes: 1, envelopes: 2 }
-   "fixes": 1,      -   "invites": 1,
+   "fixes": 0,      +   "invites": 0,
```

**Impact, west of UTC** (offset pushes the cutoff into the past — nothing is swept):

- Expired invite links stay redeemable for up to the offset. PRD §6.3 makes link expiry the only
  thing standing between a shared link and a stranger in the room.
- Location history outlives the 24-hour hard delete. This is the exact claim PRD §4 and
  `threat-model.md` §2/§4 rest on ("bounded to roughly the last day", "anything past 24h is
  hard-deleted regardless").

**East of UTC** the cutoff moves into the future and rows are deleted *early* — under BST, fixes
are dropped at 23h and invites die an hour before they expire.

**Why nothing caught it:** CI runs UTC, and the test's `NOW` is `2026-01-01`, when
`Europe/London` is GMT — so it passes on the developer's machine in winter and starts silently
over-retaining in spring.

**Fix.** Bind an explicit UTC string, or use the drizzle query builder for these two (which
routes through `PgTimestamp` and deletes the raw SQL at the same time):

```ts
await tx.delete(invite).where(lt(invite.expiresAt, now));
await tx.delete(fix).where(lt(fix.serverReceivedAt, fixCutoff));
```

The minimal version (`${now.toISOString()}`, `${fixCutoff.toISOString()}`) was applied locally
and the sweeper test then passed under `UTC`, `America/New_York`, `Europe/London` and
`Asia/Tokyo`.

The envelope delete binds no timestamps and is unaffected.

**Also add a regression test** that runs the boundary assertions under a non-UTC `TZ`, or this
comes straight back.

---

## 2. MEDIUM — the sweeper's step ordering is not actually tested

`apps/server/src/jobs/sweeper.test.ts`

PLAN.md §3 requires the fix delete to run *before* the envelope delete, so the envelope sweep
sees post-sweep state and reclaims yesterday's envelopes on the same pass. **Swapping steps 2
and 3 does not fail any test.**

The only fix that gets deleted (`oldFix`) lives in `fixRoom`, which has no envelopes at all. The
envelope room's only fix is at `NOW - 1 minute` and survives either way. So no envelope's fate
depends on whether the fix delete has run yet.

**Fix.** Add one case to the fixture: an envelope superseded at epoch N, where the only fix at
epoch N is older than 24h. Correct ordering deletes both in a single run; reversed ordering
leaves the envelope pinned until the next pass.

---

## 3. MEDIUM — `precision_grant.expiresAt` is nullable, which permits an unbounded grant

`apps/server/src/db/schema/precision.ts:57`

PRD §6.6 is explicit:

> **Grants are windowed** even though requests are not. Request-forever plus grant-forever would
> mean one approval permanently changes the room for that pair.

A nullable `expiresAt` makes grant-forever representable in the schema. `key-management-spec.md`
§7 treats `expiresAt` and `revokedAt` as independent liveness checks, which only works if
`expiresAt` is always present.

PLAN.md listed "`createdAt`, `expiresAt`, `revokedAt` nullable" in one breath — that was the
plan being loose, not a decision. The PRD is the authority.

**Fix.** `expiresAt: timestamp().notNull()`. `revokedAt` stays nullable.

---

## 4. MEDIUM — `membership` records no join timestamp

`apps/server/src/db/schema/membership.ts:7-27`

The table has `joinedEpoch` (an integer) and `removedAt`, but nothing recording *when* a
membership began. Two places need it:

- PRD §6.3 — the mitigation for forgotten guests is a persistent "Guests (n)" row **showing join
  dates**. Phase 9 (#14) cannot build that from an epoch number.
- `threat-model.md` §2 and §4 both list "join/removal dates" among what a dump or subpoena
  yields, i.e. the document assumes this column exists.

**Fix.** Add `joinedAt: timestamp().defaultNow().notNull()` and update the expected map in
`invariants.test.ts:50` to `["joined_at", "removed_at"]`.

---

## 5. MEDIUM — `membership_role` has no `admin`, and the two specs disagree

`apps/server/src/db/schema/enums.ts:17` — `["owner", "member", "guest"]`

- `key-management-spec.md` §3 and §5: "owner/admin required to remove", "Removal requires
  owner/admin role (app-layer check…)".
- `threat-model.md` §1: "role distribution (owner/member/guest)".

The enum implements the threat model's list. This is a **conflict between the two specs**, not
obviously a coding error — but Phase 5 (#10) implements member removal and its authorisation
check needs the answer. Resolve it before #10 starts, and correct whichever document is wrong;
changing a `pgEnum` after rows exist is more painful than deciding now.

---

## 6. LOW — `APP_TABLES` duplicates table names that are already imported

`apps/server/src/db/testing.ts:15-25`

Nine table names are hardcoded as strings in a file that already imports all nine table objects.
A rename in the schema leaves this list stale.

```ts
import { getTableName } from "drizzle-orm";

const APP_TABLES = [precisionGrant, precisionRequest, fix, invite,
                    roomKeyEnvelope, membership, roomEpoch, room, device].map(getTableName);
```

Deletes the duplicated list and the drift risk. Order still matters for `TRUNCATE`, so keep the
sequence.

---

## 7. LOW — `rowExists` hand-rolls a composite-key lookup through string concatenation

`apps/server/src/jobs/sweeper.test.ts:40-41`, `:202-217`

Envelope identity is carried as `` `${roomId}:${epoch}:${deviceId}` `` and taken apart again with
`id.split(":")`, `roomId ?? ""`, and `String(row.epoch) === epoch`. The `?? ""` and the
`String()` are both there to appease `noUncheckedIndexedAccess` on a shape the test invented.

Replace the string key with the composite tuple and query it directly:

```ts
const rows = await db.select().from(roomKeyEnvelope)
  .where(and(eq(roomKeyEnvelope.roomId, roomId),
             eq(roomKeyEnvelope.epoch, epoch),
             eq(roomKeyEnvelope.deviceId, deviceId)));
```

Removes ~15 lines, the stringly-typed `"invite" | "fix" | "room_key_envelope"` discriminator and
both defensive coercions.

---

## 8. LOW — dead `??` fallback before a spread that already wins

`apps/server/src/db/testing.ts:104`

```ts
memberAlias: overrides.memberAlias ?? randomUUID(),
...overrides,
```

`...overrides` is spread afterwards, so the `??` can never change the result — `memberAlias:
randomUUID()` is equivalent.

Note this pattern is **not** redundant for `userId`, `ownerId` and `createdBy`, where the
fallback exists to avoid the `seedUser(db)` side effect when a value was supplied. Only
`memberAlias` is pure. Don't "fix" the others.

---

## 9. LOW — importing `jobs/worker.ts` opens a `Queue` it never uses

`apps/server/src/jobs/worker.ts:6` imports `SWEEPER_QUEUE` from `./queue.js`, and `queue.ts:7`
constructs `new Queue(...)` at module scope. So importing the worker builder — as
`worker.test.ts` does, while passing its own queue name — creates a Queue and its Redis client
purely to read a string constant, and nothing ever closes it.

**Fix.** Move `SWEEPER_QUEUE` into its own module (or into `worker.ts`) so `queue.ts` is imported
only where a real `Queue` is wanted.

---

## 10. LOW — `worker.ts` has an unhandled rejection path and leaves the queue open

`apps/server/src/worker.ts:19` — `main()` is called with no `.catch()`. If
`registerSweeperSchedule()` rejects (Redis unreachable at boot) it surfaces as an unhandled
rejection rather than a clean non-zero exit.

`shutdown()` closes the worker and disconnects the connection but never `await sweeperQueue.close()`.

---

## 11. LOW — the guards PLAN.md flagged as most-likely-to-be-deleted carry no comment

`apps/server/src/jobs/sweeper.ts:30-33`

PLAN.md called the two `NOT EXISTS` clauses "the non-obvious part most likely to be 'simplified'
away in review". Nothing in the file says why they are there. AGENTS.md allows a concise
one-liner and this is what it is for — one line noting that a superseded envelope is retained
while a fix or the room name still needs its epoch.

Conversely, the section banners in `sweeper.test.ts:43,53,69,158,168` (`// --- invites ---` and
friends) only restate what the next line of code says, and are what AGENTS.md's "let the code
explain itself" is aimed at.

---

## 12. LOW (pre-existing, not introduced here) — `npm run build -w server` fails

```
tsconfig.json:8:5 - error TS5011: The common source directory of 'tsconfig.json' is './src'.
The 'rootDir' setting must be explicitly set to this or another path…
exit=2
```

Reproduces on `main`, so this PR did not cause it — but this PR adds `worker:start` →
`node dist/src/worker.js`, so the new worker process cannot be produced by the build. CI runs
`typecheck` but never `build`, which is why it has gone unnoticed.

**Fix.** Add `"rootDir": "src"` to `apps/server/tsconfig.json` (the emitted layout is already
`dist/src/...`, matching the existing `main` and `start` paths, so nothing else moves). Consider
adding `npm run build` to CI.

---

## 13. LOW — `information_schema` queries don't constrain `table_schema`

`devices.test.ts:16,26`, `fixes.test.ts:26`, `invariants.test.ts:16,29`

`WHERE table_name = 'device'` matches that table in any schema on the connection. Harmless today;
add `AND table_schema = 'public'` to keep it that way.

---

## Checked and found correct — do not "fix" these

- **BullMQ shared connection.** Passing one `ioredis` instance to both `Queue` and `Worker` is
  correct on bullmq 6: `createBackend` sets `shared: isRedisInstance(connection)`, so BullMQ will
  not close the caller's client, and `createBlockingConnection` calls `.duplicate()` so the
  worker's blocking fetch never stalls queue commands. `worker.ts` disconnecting the shared
  connection itself is the right complement to that.
- **The insert path's timezone handling.** Drizzle maps `Date` through `toISOString()` on write
  and appends `+0000` on read, so stored values round-trip as UTC regardless of host `TZ`.
  Finding 1 is confined to the raw-SQL bindings in `sweeper.ts`.
- **`z.url()` accepts `redis://…`** including credentials and a database suffix. `REDIS_URL`
  validates as intended.
- **Composite FKs referencing `membership_room_alias_uidx`.** Postgres accepts a foreign key
  against a unique index; no separate constraint is needed.
- **The partial unique index.** Covered by three tests that assert the pending/denied/other-pair
  cases, and it is genuinely enforced by Postgres.
- **`vitest.config.ts` using `maxWorkers: 1, isolate: false`** rather than the plan's
  `poolOptions.forks.singleFork` — equivalent serialisation for this purpose.

---

## How the verification was run

Disposable Postgres 17 container on port 55432, `drizzle-kit push`, then
`vitest run src/jobs/sweeper.test.ts src/db/schema` under each `TZ`. Redis-dependent
`worker.test.ts` was not run. Findings 1 and 12 were reproduced directly; 2 was confirmed by
reading which rows the fixture makes the ordering observable on (none).
