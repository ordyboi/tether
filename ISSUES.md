# Adversarial review — PR #30 (Phase 5, issue #10)

Reviewed at `b465518`. `npm run lint`, `format:check`, `typecheck` all pass; 57/57 non-job tests
pass. The PR's own claims hold. What follows is what passing tests do not catch.

Everything marked **confirmed** was reproduced against a real Postgres, not reasoned about.
Verbatim probe output is quoted inline.

Severity: **HIGH** = ships a false guarantee or a user-visible lockout. **MEDIUM** = wrong
behaviour under ordinary input. **LOW** = cleanup, dead code, rule violations.

---

## HIGH

### 1. Both "cryptographic fact" assertions in `no-backfill.test.ts` are tautologies

`routes/no-backfill.test.ts:191-197` and `:275-281`.

Issue #10 says these two tests "carry the entire no-backfill claim". Each ends with an assertion
framed as a cryptographic proof:

```ts
await expect(
  unwrapRoomKey(aesGcm, epoch1Envelope.wrappedKey, round3.identity.secretKey, {
    roomId, epoch: 1, deviceId: round1.deviceRow.id,
  }),
).rejects.toThrow();
```

This unwraps an envelope **addressed to `round1`'s device** using **`round3`'s secret key**. It
fails because the envelope was never addressed to that key — not because of anything about
epochs, backfill, or `joinedEpoch`. Confirmed: a brand-new keypair with no relationship to the
room at all fails identically.

```
PROBE unrelated brand-new key also fails to unwrap: true
```

The assertion would still pass if the server *did* issue `round3` envelopes for epochs 1 and 2.
It tests that X25519 + AES-GCM works, which `packages/crypto` already covers.

**Fix.** Assert the property that is actually claimed. Either:

- prove absence over the whole envelope table for that device — `SELECT ... WHERE device_id = X
  AND epoch < joinedEpoch` returns zero rows (stronger than the `/envelopes` route check, since
  it bypasses the route's own filter); and/or
- give the joiner the epoch-3 key it legitimately holds and show that no derivation from it
  reaches epoch 1's key — that is the actual "independent per-epoch keys" claim from
  `docs/key-management-spec.md` §2.

The row-count assertion at `:179` (`expect(envelopes.map((e) => e.epoch)).toEqual([3])`) is the
only load-bearing assertion in the first test today.

### 2. The removal test's envelope assertions run against an empty array — both vacuous

`routes/no-backfill.test.ts:262-264`.

```ts
const envelopes = envelopesResponse.json().envelopes as { epoch: number }[];
expect(envelopes.every((e) => e.epoch < 2)).toBe(true);
expect(envelopes.some((e) => e.epoch === 4)).toBe(false);
```

`[].every(...)` is `true` and `[].some(...)` is `false`, so both assertions hold for an empty
response regardless of server behaviour. The response *is* empty — confirmed:

```
PROBE envelopes BEFORE removal: 1
PROBE removed device revokedAt: Wed Sep 02 2026 17:19:19 GMT+0100
PROBE envelopes AFTER removal: []
PROBE every(e.epoch<2) on that array: true
```

Cause: removal globally revokes the removed user's devices (see #4), and `routes/envelopes.ts:60`
short-circuits on `revokedAt` with `return { envelopes: [] }` before the query runs. So the test
never reaches the `joinedEpoch` / `removedAt` filter it is supposed to be exercising.

**Fix.** Assert a non-empty baseline first (`expect(envelopes.length).toBeGreaterThan(0)`) so the
test cannot pass on an empty array, then assert the epoch bound. Add a case where the removed
member still has another active membership, so the device is *not* revoked and the query's
`isNull(membership.removedAt)` / `joinedEpoch` conditions are actually the thing under test.

### 3. 500 responses leak the SQL statement and its bound parameters, including the caller's user id

`routes/rooms.ts:77`, `routes/rooms.ts:92`, `routes/invites.ts:31`.

Path params are `as`-cast and never validated, so a non-UUID `:roomId` reaches Postgres and the
driver error is returned verbatim to the client. Confirmed:

```
GET /rooms/not-a-uuid/devices -> 500
{"statusCode":500,"error":"Internal Server Error","message":"Failed query: select \"id\",
\"room_id\", \"user_id\", \"member_alias\", \"display_name_ciphertext\", \"role\",
\"joined_epoch\", \"joined_at\", \"removed_at\" from \"membership\" where ((\"membership\".
\"room_id\" = $1) and (\"membership\".\"user_id\" = $2) and ((\"membership\".\"removed_at\" is
null)))\nparams: not-a-uuid,F9i7yWJJyIRiKfjk02zxd03LiQ3Vg3J8"}
```

That response body contains the full column list of `membership` and, in `params`, **the caller's
Better Auth user id**. For a project whose threat model is built on what the server can be made
to reveal (`docs/threat-model.md` §2, §4), returning schema and identifiers in an error body is
the wrong default. It reaches the logs on the same path.

**Fix.** Two independent changes, both wanted:

- Validate path params with zod (`z.uuid()`) like every other input, and drop the `as` casts.
  AGENTS.md forbids `as` casting; here it is also what hides the missing validation.
- Add a fallback branch to the error handler in `app.ts:125` so unrecognised errors return a
  generic 500 body. Today `sendHttpError` (`rooms/errors.ts:48`) rethrows and the handler
  rethrows again, so the driver's message is what ships.

### 4. Removal permanently locks a device out of *every* room, with no recovery path

`routes/rooms.ts:147-156` and `routes/devices.ts:18-25`.

On removal, if the target holds no other active membership anywhere, **all** their devices get
`revokedAt` set. Re-registering the same identity key returns the still-revoked row, unchanged:

```
PROBE re-register status: 200
PROBE re-register revokedAt still set: 2026-09-02T16:19:19.456Z
```

Consequence chain: `revokedAt` is set → `requiredDeviceIds` (`rooms/rekey.ts:43`) filters the
device out of every future wrap set → an envelope submitted for it is rejected as `extra` (400) →
`GET /envelopes` returns `[]` for it forever. A user removed from their only room can accept a
new invite to any room, become a member, and never receive a room key. Nothing in the codebase
clears `revokedAt`.

`docs/key-management-spec.md` §1 anticipates this — "a device that is revoked and later wants
back in registers a fresh keypair" — but the API contradicts it by returning 200 with the revoked
row rather than making the client generate a new keypair.

**Fix.** Pick one and make it explicit: (a) don't globally revoke on removal at all — this room's
envelopes already stop the moment `removedAt` is set, which the inline comment at `rooms.ts:143`
already concedes; or (b) have `POST /devices` refuse a revoked identity key (409, "register a
fresh keypair") so the client follows spec §1. Either way, add a test that removes a member from
their only room and then rejoins them to a different one.

---

## MEDIUM

### 5. Duplicate `deviceId` in a wrap set → 500 instead of 400

`rooms/rekey.ts:49-56`. `validateWrapSet` compares *sets*, so `[{deviceId: A}, {deviceId: A}]`
passes validation; `writeEnvelopes` then violates the `(roomId, epoch, deviceId)` primary key.
Confirmed: `duplicate deviceId in wrap set -> 500 {"statusCode":500,...,"message":"Failed query:
insert into \"r...`. Reject duplicates in `validateWrapSet` (compare lengths, or add a `duplicate`
list to `WrapSetMismatchError`).

### 6. Colliding client-supplied `roomId` → 500, and an existence oracle

`rooms/rekey.ts:141-159`. `POST /rooms` accepts a client-chosen `roomId` with no pre-check, so
re-using an existing id raises a primary-key violation. Confirmed: `duplicate roomId -> 500`.
Should be a 409. As written it also distinguishes "room exists" (500) from "room does not exist"
(201) to an unauthenticated-of-that-room caller.

### 7. `bytea` is returned as a JSON byte array while input is base64

Confirmed on `GET /rooms` and `POST /invites/lookup`:

```
{"roomId":"e8d9...","currentEpoch":0,"nameCiphertext":{"type":"Buffer","data":[110]},...}
{"roomId":"e8d9...","grantsRole":"member","wrappedRoomKey":{"type":"Buffer","data":[107]},...}
```

Every request encodes ciphertext as base64 (`routes/schemas.ts:3`); every response returns
Node's `Buffer` JSON shape. Phase 6's client has to hand-roll the asymmetry, and it costs roughly
6× the bytes — for a 60-envelope fetch of 80-byte wrapped keys that is ~30KB instead of ~5KB.
Serialise responses back to base64 (a small response mapper next to `base64Bytes`).

### 8. No length validation on `identityPublicKey` or any ciphertext field

`routes/schemas.ts:3` and its seven use sites (`:7,12,17,26,29,36,47`). X25519 public keys are exactly 32 bytes; the schema
accepts any base64. Confirmed: `PROBE 3-byte identityPublicKey -> 201`. Such a device is
permanently unwrappable-to but is still included in every required device set, so it blocks
every future epoch bump for that room until removed. Add `.refine((b) => b.length === 32)` to
`identityPublicKey` and upper bounds to the ciphertext fields.

### 9. `tokenHash` accepts any string, and the token endpoints are unauthenticated and unlimited

`routes/schemas.ts:34` (`z.string().min(1)`). Confirmed: `tokenHash='x' accepted -> 201`, and
`unauthenticated lookup of guessed token -> 200`. The token is a bearer credential — guessing it
is enough to redeem an invite and become a member — but the server enforces no floor on its
entropy and neither `/invites/lookup` nor `/invites/redeem` is rate limited. Constrain
`tokenHash` to `/^[0-9a-f]{64}$/`, and note rate limiting as a follow-up if it is out of scope
for this phase.

### 10. Invite expiry is unbounded, and invites survive epoch bumps

`routes/schemas.ts:38`. Confirmed: `100-year expiry + sha256('password') invite -> 201`.

Two consequences. The retention promise (`docs/threat-model.md` §2, §4 — a dump yields "roughly
the last day") does not hold for `invite`, which is identity-linked via `createdBy` and which the
sweeper only deletes once `expiresAt` has passed. And because nothing revokes outstanding invites
on an epoch bump, an invite minted at epoch 1 and redeemed at epoch 9 still hands the joiner
epoch 1's wrapped room key — read access to a historical epoch, granted through a channel the
no-backfill tests do not cover. Cap `expiresAt` (spec/PRD should name the window), and revoke
outstanding invites for a room inside `runRekey`.

---

## LOW — deletions and rule violations

The brief was to delete as much as possible without changing behaviour. In rough order of value:

### 11. `applyRekey` is dead in production — only tests call it

`rooms/rekey.ts:118-123`, plus the three-line comment at `:87-89` that exists only to explain the
split. Every route uses `runRekey` inside its own transaction. Delete it and have
`rooms/rekey.test.ts` wrap `db.transaction((tx) => runRekey(tx, ...))` itself. ~12 lines.

### 12. `requiredDeviceIds` is a copy of `listActiveDevices` — and the duplication is load-bearing

`rooms/rekey.ts:13-26` vs `:33-47`: identical `from`/`innerJoin`/`where`, differing only in
selected columns. This is not just noise. `listActiveDevices` is what `GET /rooms/:roomId/devices`
tells clients to wrap for; `requiredDeviceIds` is what the server validates against. If one
predicate is ever edited without the other, every mutation starts failing with a 400 that names
the right devices — a confusing outage from a one-line edit. Express one in terms of the other:

```ts
const rows = await listActiveDevices(tx, roomId, newEpoch);
return new Set(rows.map((row) => row.deviceId));
```

### 13. `inviteRedeemSchema.deviceId` is never read

`routes/schemas.ts:48`. `routes/invites.ts` never references `body.deviceId`; the joiner's devices
are found through `membership.userId` instead. It is a required field, so every client must send a
value that is discarded — and it reads like an authorisation check that isn't there. Delete it
(and from the callers in `no-backfill.test.ts:136` and the load test).

### 14. Smaller deletions

- `routes/invites.ts:1-2` — two separate `import ... from "node:crypto"` lines; merge.
- `type AppDatabase = typeof clientDb` is declared three times (`rooms/rekey.ts:9`,
  `db/testing.ts:13`, `jobs/sweeper.ts:11`). Export it once from `db/client.ts`.
- `routes/rooms.ts:15-30` — `requireActiveMembership` does `select()` (all nine columns) and its
  return value is discarded at the only call site (`:79`). `select({ id: membership.id })`.
- The `...(x === undefined ? {} : { k: x })` spread appears five times (`routes/rooms.ts:59,65`,
  `rooms/rekey.ts:146,151`, `routes/devices.ts:33`). `exactOptionalPropertyTypes` is not enabled
  in `tsconfig.base.json`, so plain optional properties work and each of these collapses to one
  line.
- `rooms/errors.ts:32` — `StaleEpochError` extends `HttpError` with a hardcoded 409 while
  `ConflictError` sits right above it doing the same thing. Extend `ConflictError`.

### 15. Comment blocks exceed AGENTS.md's "concise one liner" rule

AGENTS.md: *"never leave verbose comments, let the code explain itself, if you have to comment
make it a concise one liner."* Multi-line blocks in this PR:

| File | Lines | Length |
|---|---|---|
| `rooms/rekey.ts` | 82-89 | 8 |
| `rooms/rekey.ts` | 138-140 | 3 |
| `routes/rooms.ts` | 143-146 | 4 |
| `routes/invites.ts` | 125-127 | 3 |
| `routes/invites.ts` | 18-19 | 2 |
| `routes/schemas.ts` | 23-24 | 2 |
| `routes/no-backfill.test.ts` | 1-5 | 5 |
| `routes/no-backfill.test.ts` | 181-183 | 3 |
| `routes/no-backfill.test.ts` | 266-267 | 2 |

Most explain *why*, which is the defensible kind — but the rule as written is one line, and
several of these (the `rekey.ts:82-89` block especially) restate what the code below does. Cut
each to one line or move the rationale into the PR body. Note that `rekey.ts:87-89` disappears
with #11 and `no-backfill.test.ts:181-183` / `:266-267` disappear with #1.

### 16. `as` casts in tests

`routes/*.test.ts` and `rooms/rekey.load.test.ts` contain 11 `response.json() as {...}` casts.
AGENTS.md's "avoid `as` casting" is not scoped to production code. A small typed
`json<T>(response)` helper in a shared test util would remove all of them.

---

## Missing coverage worth adding

Each of these is a bug above that no existing test would have caught:

- Remove a member from their only room, then have them join a different room and receive an
  envelope (#4).
- `GET /envelopes` for a removed member whose device is *not* revoked, so the route's
  `removedAt` / `joinedEpoch` filter is exercised at all (#2).
- Malformed (non-UUID) `:roomId` on all three routes that take one (#3).
- Duplicate `deviceId` in a wrap set (#5); duplicate `roomId` on create (#6).
- Response encoding of any `bytea` field (#7).

## Not defects — checked and correct

Recorded so the next reviewer does not re-derive them:

- The step-3-before-step-5 ordering the plan called for is implemented *and* tested from both
  sides (`rekey.test.ts:72`, `:108`).
- `POST /devices` correctly 409s an identity key belonging to another user (confirmed).
- The `/envelopes` join cannot fan out: `(roomId, userId)` is unique on `membership`.
- No lock-order inversion between `/invites/redeem` (invite → room) and `/rooms/:id/removals`
  (room only) — no cycle, so no deadlock.
- A malicious joiner can submit garbage wrapped keys and garble one epoch for everyone, but the
  room is recoverable: minting a new epoch key does not require holding the previous one. This is
  the trust boundary `docs/key-management-spec.md` §3 explicitly accepts, not a defect.
- `docs/rekey-churn.md` is accurate and genuinely useful to Phase 11; the flat server-side cost
  across N is real (one batched insert).

---

## Reproducing

The probes above ran against an isolated Postgres so as not to truncate the shared dev database:

```
docker run -d --name tether-review-pg -e POSTGRES_USER=tether -e POSTGRES_PASSWORD=tether \
  -e POSTGRES_DB=tether -p 55432:5432 postgres:17
# .env: DATABASE_URL=postgres://tether:tether@localhost:55432/tether
npm ci && npm run build -w @tether/crypto && npm run db:push -w server
npx vitest run --exclude "src/jobs/**"   # from apps/server
```
