# Phase 5 — rooms, epochs, envelopes (issue #10)

## Context

Phase 4 (#9, merged) landed every application table and the sweeper, but nothing writes to those
tables yet. There is no way to create a room, no way for a room key to reach a device, and no
membership. Phase 5 is the server-side API that makes the schema live: create a room, mint epochs,
store and serve envelopes keyed to `joinedEpoch`, create and redeem invites against `tokenHash`,
create memberships with aliases, and remove a member with the epoch bump and envelope re-issue
that follows. Phases 6–11 are all blocked on it.

Two things make this phase load-bearing beyond "add some CRUD":

- **`docs/key-management-spec.md` §3 is a security claim the server enforces.** Envelopes are
  only issued for epochs at or after a member's `joinedEpoch`, and because room keys are
  independent random values per epoch (§2, no hash chain), a device never issued an envelope for
  epoch *N* has no cryptographic path to anything sealed under epoch *N*. History is unreadable
  by construction. Issue #10's acceptance criteria say the two integration tests proving this
  "carry the entire no-backfill claim" — they are the deliverable, not decoration.
- **The rekey churn number gates Phase 11.** Phase 0b measured ~53ms p50 per device for the
  X25519 wrap + HKDF derive an epoch bump does per member (Pixel 7, n=102, p95 ≈77ms, worst
  ≈391ms). The load test here supplies the other half: what the *server* costs at N devices per
  bump, at household scale and 10×.

The server never holds a room key. Wrapping happens on the acting client; the server stores
opaque bytes, validates the wrap set is complete, and serves each envelope only to the device
named in its row (§3).

## Decisions taken

| Decision | Choice |
|---|---|
| Device registration | `POST /devices` ships in this phase. Phase 6 (#11) stays purely client-side. |
| `memberAlias` | Server-generated random UUID, returned in the response. Client uses it as the ratchet salt (spec §7). |
| Invite lookup transport | `POST /invites/lookup` with `{ token }` in the body — the token never enters a URL, so it can never reach an error log or a proxy. |
| Load test assertions | Correctness only (full envelope set written). Timings printed and recorded in a committed `docs/rekey-churn.md`. No wall-clock thresholds in CI. |
| Headline tests use real crypto | The two no-backfill tests import `@tether/crypto` and actually fail to unwrap. Requires a CI build step — see §7. |
| Concurrency | A `FOR UPDATE` row lock on `room` plus a client-supplied `expectedEpoch`; mismatch is a 409 and the client re-wraps. |
| Removals | `POST /rooms/:roomId/removals`, not `DELETE` — the request carries the whole re-wrap payload. |

## Before writing code

1. You are on `feat/5-rooms-epochs-envelopes`, branched from `main` at the Phase 4 merge (#29).
   Everything below is verified against that tree, not against the PR branch.
2. `docker compose up -d` (Postgres + Redis) and `npm run db:push -w server`. Per AGENTS.md,
   never write migrations.
3. Re-read `docs/key-management-spec.md` §3, §4 and §5 in full. They are the specification for
   this phase; everything below is their translation into routes.
4. TDD, per AGENTS.md: tests before implementation.

What Phase 4 left you, and the conventions it set:

- `apps/server/src/db/schema/` — one file per aggregate, all re-exported from the barrel
  `schema.ts`, which is what `drizzle.config.ts` points at. No new tables are needed in this
  phase; if that turns out to be wrong, add the file *and* the barrel line.
- `apps/server/src/db/testing.ts` — `seedUser`, `seedDevice`, `seedRoom`, `seedEpoch`,
  `seedMembership`, `seedEnvelope`, `seedInvite`, plus `truncateAppTables`. Reuse these; do not
  write a second set of seeders.
- `apps/server/vitest.setup.ts` already calls `truncateAppTables` in a global `beforeEach`, so
  **do not add per-file truncation**. `vitest.config.ts` runs `maxWorkers: 1`, `isolate: false`
  — tests share one database and one process.
- `apps/server/src/constants.ts` — shared constants live here, not scattered per module.

---

## 1. Shared plumbing

**`apps/server/src/auth/session.ts`** — a Fastify `preHandler` that resolves the caller via
`auth.api.getSession({ headers: fromNodeHeaders(request.headers) })` and 401s when absent. Attach
`userId` to the request via `app.decorateRequest`. `auth` is already configured in
`apps/server/src/auth/auth.ts`; do not build a second auth path.

**`apps/server/src/auth/testing.ts`** — `createSignedInUser()` returning `{ userId, cookie }`.
The `anonymous()` plugin is already enabled in `auth.ts`, so `auth.api.signInAnonymous()` gives a
real session in one call. Do **not** copy `auth.test.ts`'s stubbed-fetch Google OAuth dance; it
exists to prove PII stripping, not to be a fixture.

**`apps/server/src/routes/schemas.ts`** — zod helpers shared by every route body. The one that
matters: `base64Bytes` (`z.base64().transform((v) => Buffer.from(v, "base64"))`), since every
ciphertext column is `bytea` and travels as base64. Per AGENTS.md, no `as`, no `any`, no explicit
return type annotations, avoid `undefined`.

**`apps/server/src/rooms/errors.ts`** — small typed error → status mapping so handlers stay thin.

Register the new route plugins in `apps/server/src/app.ts` next to `authRoutes`/`healthRoutes`.
Do not touch `trustProxy: false`, `disableRequestLogging: true`, or the log serializers — the
"nothing writes an IP address or user agent" invariant lives there and `app.test.ts` guards it.

## 2. The epoch bump primitive — build this first

**`apps/server/src/rooms/rekey.ts`**, exporting `applyRekey(tx, params)`. Room creation, invite
redemption and removal are all the same transaction with a different membership mutation in the
middle. Write it once.

Payload shape shared by every mutating endpoint:

```
expectedEpoch: number          // room.currentEpoch the client wrapped against
nameCiphertext: base64         // room name re-sealed under the new key (spec §6)
envelopes: [{ deviceId, wrappedKey: base64 }]
```

**Every query in this phase goes through the drizzle query builder. No raw `sql` templates.**
Phase 4 took a HIGH review finding for binding a `Date` into a `sql` template: node-postgres
serialises it in the host's local offset, which Postgres then discards parsing into `timestamp
without time zone`, silently shifting the value by the host's UTC offset. The builder is immune
to that, and this repo goes further than most — `apps/server/src/db/information-schema.ts`
declares `information_schema.columns` as a `pgSchema` table so that even schema introspection is
typed and builder-driven. Follow that. The one snippet below is the builder; treat any SQL you
see in a spec or a doc as description, not as code to paste.

Inside one `db.transaction`:

1. Lock the room row: `tx.select().from(room).where(eq(room.id, roomId)).for("update")` —
   serialises concurrent bumps.
2. `room.currentEpoch !== expectedEpoch` → **409**. The client refetches the device set and
   re-wraps; it must not retry blindly with the same envelopes.
3. **Apply the membership mutation** (insert / reactivate / set `removedAt`).
4. `newEpoch = currentEpoch + 1`; insert `room_epoch(roomId, newEpoch, reason)`.
5. Compute the required device set **as of `newEpoch`** and require the submitted `deviceId`s to
   equal it exactly — reject with **400** and the missing/extra ids otherwise:

   ```ts
   tx
     .select({ id: device.id })
     .from(device)
     .innerJoin(membership, eq(membership.userId, device.userId))
     .where(
       and(
         eq(membership.roomId, roomId),
         isNull(membership.removedAt),
         lte(membership.joinedEpoch, newEpoch),
         isNull(device.revokedAt),
       ),
     );
   ```

6. Insert the `room_key_envelope` rows — one `tx.insert(roomKeyEnvelope).values([...])`, not a
   loop. At 10× household scale that difference is the load test's headline number.
7. `tx.update(room).set({ currentEpoch: newEpoch, nameCiphertext, nameEpoch: newEpoch })`.

**Step 3 must precede step 5.** Ordering is what makes one query serve all three mutations: a
joiner inserted with `joinedEpoch = newEpoch` falls *into* the set, a removed member with
`removedAt` set falls *out* of it. Write a test that fails if the two steps are swapped — Phase 4
took a review finding for exactly this class of untested ordering dependency.

Note there is deliberately **no endpoint that writes an envelope for any epoch other than the one
being minted**. That absence is the no-backfill invariant. Device linking (spec §8) writes
envelopes for an existing epoch and is Phase 12 — do not add it here.

## 3. Endpoints

`apps/server/src/routes/devices.ts`, `rooms.ts`, `envelopes.ts`, `invites.ts`.

| Method | Path | Auth | Behaviour |
|---|---|---|---|
| POST | `/devices` | session | Register `{ identityPublicKey, platform, pushToken? }`. `identityPublicKey` is unique: return the existing row if it belongs to the caller, 409 if it belongs to someone else. |
| GET | `/rooms` | session | The caller's active memberships joined to room metadata: `currentEpoch`, `nameCiphertext`, `nameEpoch`, `precisionPolicy`, `approximateRadiusM`, plus own `memberAlias`, `role`, `joinedEpoch`. |
| POST | `/rooms` | session | Create. Body: `nameCiphertext`, `precisionPolicy`, `approximateRadiusM?`, `displayNameCiphertext`, `envelopes[]`. Writes `room` (`currentEpoch = 0`, `nameEpoch = 0`), `room_epoch(0, 'created')`, owner `membership` (`joinedEpoch = 0`, server-generated alias), and the epoch-0 envelopes — validated against the same device-set query at `newEpoch = 0`, which reduces to the caller's own non-revoked devices. |
| GET | `/rooms/:roomId/devices` | session + active membership | The wrap-target list: `{ epoch: currentEpoch, devices: [{ deviceId, identityPublicKey }] }`. Clients call this immediately before every mutation. |
| GET | `/envelopes` | session + device ownership | Query `deviceId`, optional `roomId`, `sinceEpoch`. Serves only envelopes whose `deviceId` belongs to the caller, whose device is not revoked, whose membership is active, and where `epoch >= membership.joinedEpoch`. |
| POST | `/rooms/:roomId/invites` | session + owner/admin | Body `{ tokenHash, grantsRole, wrappedRoomKey, wrappedRoomKeyEpoch, expiresAt }`. The client hashes the token; the raw token never reaches the server at creation. `grantsRole` may never be `owner`; an admin may grant only `member`/`guest`. |
| POST | `/invites/lookup` | none — the token is the bearer | Body `{ token }`; server matches `SHA-256(token)` against `tokenHash`. Returns `roomId`, `grantsRole`, `wrappedRoomKey`, `wrappedRoomKeyEpoch`, `expiresAt`. 404 for missing/expired/redeemed/revoked, undifferentiated. |
| POST | `/invites/redeem` | session | Body `{ token, displayNameCiphertext, deviceId }` + the rekey payload. Validates the invite inside the transaction, rejects an already-active membership with 409, then `applyRekey` with `reason = member_joined \| guest_joined` (from `grantsRole`), inserting the membership at `joinedEpoch = newEpoch` with a server-generated alias, and sets `invite.redeemedAt`. |
| POST | `/rooms/:roomId/removals` | session + owner/admin | Body `{ alias }` + the rekey payload. Sets `membership.removedAt`, then `applyRekey` with `reason = member_removed \| guest_removed`. The room owner cannot be removed. |

Nothing in this phase reads or writes `fix`, `precision_request` or `precision_grant` — those are
Phases 7 and 10.

### Two things that will bite

**Rejoin after removal.** `membership` has `uniqueIndex(roomId, userId)`, so a removed member
redeeming a new invite collides. Reuse the existing row: reset `joinedEpoch = newEpoch`,
`removedAt = null`, `role`, `displayNameCiphertext` — and **keep `memberAlias` unchanged**.
`fix.(roomId, authorAlias)` is a foreign key onto `membership.(roomId, memberAlias)`, so rotating
the alias would orphan any surviving `fix` rows. The threat model (§2) already treats the
alias↔user link as visible server-side, so retaining the alias costs nothing that was promised,
and the old rows are swept within 24h regardless.

**Device revocation on removal.** Spec §5 step 4 wants revocation scoped to one room, but the
Phase 4 schema only has a global `device.revokedAt`. Set it only when the removed user has no
other active membership in any room. This is safe: envelopes for *this* room stop the moment
`membership.removedAt` is set, because the device-set query in §2 filters on it — `revokedAt` is
belt-and-braces plus the sweeper's dead-envelope trigger. Call the deviation out in the PR body.

## 4. The two headline tests

`apps/server/src/routes/no-backfill.test.ts`. Issue #10 requires these to be readable and
self-contained by someone who has not seen the implementation, so: build the whole scenario from
HTTP calls in the test body, keep local named helpers in the file, and reach for
`db/testing.ts`'s seeders only where they do not obscure the story.

Use the real `@tether/crypto` (`generateRoomKey`, `wrapRoomKey`, `unwrapRoomKey`,
`generateIdentityKeyPair`) so each test ends on a cryptographic fact rather than a row count.

1. **A member joining at epoch 3 receives no envelope for epochs 1 and 2.** Create a room, bump it
   to epoch 3 through two invite redemptions, then join a fourth member. Assert `GET /envelopes`
   returns nothing below epoch 3, and that the joiner's device key cannot unwrap an epoch-1
   envelope belonging to another device.
2. **A member removed before epoch 4 receives no envelope for epoch 4.** Remove them at the bump
   to epoch 4, assert the removal response's wrap set excludes their device, that `GET /envelopes`
   returns nothing at epoch 4, and that epoch 4's key is unreachable from the epoch-3 key they
   still hold (independent per-epoch keys, spec §2).

Alongside, in the relevant route test files: role checks on invite creation and removal, expired /
redeemed / revoked invite lookups, the 409 on a stale `expectedEpoch`, the 400 on an incomplete or
over-broad wrap set, the step-3-before-step-5 ordering regression, and owner-cannot-be-removed.

## 5. Load test

`apps/server/src/rooms/rekey.load.test.ts`. Household scale **N = 6** devices and **N = 60**.
Drive `app.inject` against real Postgres so the measurement includes routing, validation and the
transaction. Per device, do the client-side wrap with `@tether/crypto` so the recorded figure is
end-to-end, then report the server-only portion separately.

Assert correctness — every expected envelope row present, none extra, `room.currentEpoch` and
`nameEpoch` advanced. Print timings; assert no wall-clock threshold, so a slow CI runner cannot
turn this into a flake. Raise the vitest timeout for this file only (the global setup's truncate
already runs per test; do not add another).

Write the results into **`docs/rekey-churn.md`**: the per-bump wall clock at each N, the
server-only share, envelopes written per bump, and the Phase 0b per-device figure (~53ms p50,
~77ms p95, ~391ms worst, Pixel 7) with the extrapolation to N devices. Phase 11 (#16) reads this
file.

## 6. Files

New under `apps/server/src/`:

```
auth/session.ts              auth/testing.ts
rooms/rekey.ts               rooms/errors.ts
rooms/rekey.test.ts          rooms/rekey.load.test.ts
routes/schemas.ts
routes/devices.ts            routes/devices.test.ts
routes/rooms.ts              routes/rooms.test.ts
routes/envelopes.ts          routes/envelopes.test.ts
routes/invites.ts            routes/invites.test.ts
routes/no-backfill.test.ts
```

Modified: `apps/server/src/app.ts` (register the four route plugins), `apps/server/package.json`
(`@tether/crypto` as a devDependency), `.github/workflows/ci.yml` (§7), plus new
`docs/rekey-churn.md`. No schema changes, no new env vars, no migrations.

## 7. Verification

`@tether/crypto` resolves to `dist/src/index.js`, which does not exist until the package is built.
Add `npm run build -w @tether/crypto` to `ci.yml` before the existing `npm run build -w server`
step, or the headline tests fail in CI while passing on a developer machine that happened to have
built it already.

Then, locally and in this order:

```
docker compose up -d
npm install
npm run build -w @tether/crypto
npm run db:push -w server
npm run lint && npm run format:check && npm run typecheck
npm run build -w server
npm test
```

Per AGENTS.md: never start a dev server to verify; run format, lint and test before committing;
conventional commits. Confirm the load test printed its numbers and that `docs/rekey-churn.md`
matches them. Sanity-check the invariants by hand once: `grep` the new tests for any string that
looks like an invite fragment (nothing after `#` may appear in a request or a fixture), and
confirm no new route logs a header.

## 8. PR

Title `Issue #10: creating rooms, joining by invite, and the rekey that follows every membership
change`. Body should state plainly which acceptance criteria each test covers, quote the recorded
churn numbers, and flag the room-scoped-device-revocation deviation in §3.
