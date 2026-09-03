# Tether API refactor — Issues #31 and #32

Two issues, two agents, one plan. **Part A** is issue #31; **Part B** is issue #32. Part B builds
on Part A — read [§0 Coordination](#0-coordination) before starting either.

---

## Context

Phase 6 (#11) is the first time `apps/mobile` calls `apps/server`, and today nothing binds the
two sides.

**#31 — nothing defines the request wire.** Request schemas live in
`apps/server/src/routes/schemas.ts` and their fields `.transform()` into Node `Buffer`, so React
Native cannot import them; the client would hand-write its types and let them drift.

**#32 — nothing defines the response wire.** Responses are unspecified anywhere, so routes ship
raw Drizzle rows: `POST /devices` puts `userId` and `pushToken` on the wire,
`POST /rooms/:roomId/invites` leaks `tokenHash` and `createdBy`, and `GET /rooms` returns `roomId`
while `POST /rooms` returns `room.id`. Errors are `{ error, ...details }` with no machine-readable
discriminant, so the join flow would have to match 409-stale-epoch on an English string.

Outcome: one package defines both directions of the wire, both sides typecheck against it, and
the mobile client can be written in Phase 6 without guessing.

---

## 0. Coordination

### Branch topology (confirmed)

```
main
  └── refactor/31-shared-api-contract     (agent A) → PR "Issue #31: ..."
        └── refactor/32-response-schemas  (agent B) → PR "Issue #32: ..."
```

Agent B branches off A's branch and starts immediately; B rebases onto `main` once #31 merges.

### What B may assume A has created

B depends on exactly these, and must not re-create them:

| Artifact | Created by A |
| --- | --- |
| `packages/api` package, `exports` map, build/test scripts | §A.1 |
| `packages/api/src/constants.ts`, `base64.ts`, `schemas.ts`, `types.ts`, `index.ts` | §A.1 |
| `packages/api/src/client/index.ts` — `createTetherClient`, `TetherApiError` | §A.1 |
| `apps/server/src/zod-type-provider.ts` — validator **and serializer** compilers | §A.2 |
| `setValidatorCompiler` / `setSerializerCompiler` wired in `app.ts` | §A.2 |
| `app.withTypeProvider<ZodTypeProvider>()` on every route file | §A.2 |
| `apps/server/src/routes/bytes.ts` — `toBase64` / `fromBase64` | §A.2 |
| `onRequest: requireSession` (moved off `preHandler`) | §A.2 |
| `npm run build -w @tether/api` step in CI | §A.4 |

### Collision surface — keep the rebase cheap

- **`packages/api/src/index.ts`** — both add re-export lines. B adds its schemas in **new** files
  (`responses.ts`, `errors.ts`), so only the re-export block conflicts.
- **`apps/server/src/app.ts`** — A adds the two compilers; B adds an `onRoute` hook and rewrites
  `setErrorHandler`. Different regions of the file.
- **The four route files** — A adds `schema: { body/params/querystring }`; B adds
  `schema: { response }` to the same objects. Same lines. B rebases carefully here.
- **`apps/server/src/routes/validation.test.ts`** — A creates it asserting the *old* error body;
  **B updates it** to the new `{ code, message, details }` shape (§B.5). This is expected, not a
  regression.

---

## Shared decisions (confirmed with the user)

1. **`requireSession` moves from `preHandler` to `onRequest`** (A). Declared schemas validate at
   `preValidation`, which runs *before* `preHandler` — so an unauthenticated request with a bad
   body would flip 401 → 400. `onRequest` runs before validation and `requireSession` only reads
   headers, so 401 keeps winning.
2. **The client covers all nine endpoints** (A), so B and Phase 6 add no new surface.
3. **Auth is injected**: `createTetherClient({ baseUrl, fetch, headers })`, `headers` being an
   optional async function. Cookie-vs-bearer stays a Phase 6 decision.
4. **Non-2xx throws `TetherApiError`** carrying `status` and body.
5. **`POST /rooms` flattens to a bare `RoomSummary`** (B) — no `{ room, memberAlias }` envelope.
6. **One error `code` per condition** (B), not one `conflict` bucket.
7. **Error bodies become `{ code, message, details? }`** (B); raw `ZodIssue[]` is replaced by a
   slim `details.fields: [{ path, message }]`.
8. **Encode at the handler edge, both directions.** A decodes base64 → `Buffer` in the handler;
   B converts `Date` → `.toISOString()` in the handler. `@tether/api` stays free of encode tricks.

---

## Verified mechanics — do not re-derive

Checked against the installed `fastify@5` and `zod@4.5.4`.

**Why the hand-written provider, not `fastify-type-provider-zod`:**

- `fastify/lib/validation.js` → `validateParam` accepts `{ value }` (assigns onto
  `request[part]`) and `{ error }` (returns it).
- `wrapValidationError` (same file, L265) returns an `Error` **instance untouched**, only
  stamping `statusCode = 400` and `code = 'FST_ERR_VALIDATION'`.
- `zod@4.5.4`'s classic `ZodError` **does** extend `Error` (verified at runtime).

So returning `{ error: result.error }` delivers the real `ZodError` to `setErrorHandler`, the
existing `instanceof ZodError` branch matches, and the 400 body is preserved.
`fastify-type-provider-zod` breaks exactly this by converting failures to a plain array, and drags
`@fastify/swagger` + `openapi-types` in as non-optional peers.

**The serializer fail-open and its fix:**

- `fastify/lib/reply.js:1078` `serialize()` → `getSchemaSerializer(context, statusCode)`; on a
  miss it falls through to bare `JSON.stringify` at `:1083`. That is the silent fail-open #32
  warns about.
- `fastify/lib/schemas.js:168` shows a **`4xx`/`5xx` wildcard fallback** after the exact-status
  lookup. Declaring `4xx` and `5xx` once per route closes the hole for every error path.
- `fastify/lib/route.js:295` runs `onRoute` hooks **before** `compileSchemasForSerialization` at
  `:437` — so an `onRoute` hook can inject those wildcards into every route.

**Zod behaviour relied on:** `z.object()` strips unknown keys by default, which is what makes
`schema.parse(payload)` in the serializer drop undeclared Drizzle columns.

---

# Part A — Issue #31: shared API contract package

> Agent A. Branch `refactor/31-shared-api-contract` off `main`.
> **Response shapes are deliberately untouched here.**

## A.1 New package: `packages/api`

```
packages/api/
  package.json
  tsconfig.json
  src/
    constants.ts        MAX_CIPHERTEXT_BYTES, INVITE_MAX_TTL_DAYS  (moved off the server)
    base64.ts           base64ByteLength() + the base64 zod primitives
    schemas.ts          the nine request schemas — base64 strings, never Buffer
    types.ts            z.infer aliases; type-only imports so it erases at runtime
    index.ts            server entry: re-exports constants, schemas, types
    client/index.ts     createTetherClient + TetherApiError; type-only imports
    base64.test.ts
    purity.test.ts
    client/client.test.ts
```

### `package.json`

Mirror `packages/crypto/package.json` (private, `type: module`, `build`/`typecheck`/`test`
scripts, `vitest` + `typescript` devDeps), with two differences:

- `"dependencies": { "zod": "^4.5.4" }` — the package genuinely owns zod; hoisting dedupes it
  with the server's copy.
- an `exports` map instead of `main`/`types`, `react-native` **first** so Metro and jest-expo
  (which sets `customExportConditions: ["react-native"]`) pick the TS source:

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
  "./client": {
    "react-native": "./src/client/index.ts",
    "types": "./dist/client/index.d.ts",
    "default": "./dist/client/index.js"
  }
}
```

### `tsconfig.json`

Copy `apps/server/tsconfig.json` (NodeNext, `rootDir: "src"`, `declaration: true`,
`include: ["src/**/*.ts"]`). `rootDir: "src"` — **not** crypto's `rootDir: "."` — so built paths
are `dist/index.js` / `dist/client/index.js`, matching the exports map.

### `src/base64.ts`

`z.base64()` already rejects non-base64 and guarantees a length that is a multiple of 4, so
decoded length is arithmetic — no `Buffer`:

```ts
export function base64ByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}
```

`z.base64()` accepts `""`, so the empty string must be rejected explicitly (`bytes > 0`).
Export `ciphertextBase64` (1..`MAX_CIPHERTEXT_BYTES`) and `identityPublicKeyBase64` (exactly 32
bytes), keeping the existing refinement messages verbatim.

### `src/schemas.ts`

Port `apps/server/src/routes/schemas.ts` field-for-field, with two changes:

- `base64Bytes` / `ciphertextBytes` / `identityPublicKeyBytes` become their string counterparts —
  **drop `.transform(Buffer.from)`**.
- `inviteCreateSchema.expiresAt` stays `z.iso.datetime()` (string) and keeps the max-TTL
  `.refine()` against `Date.now() + INVITE_MAX_TTL_MS`; **drop `.transform(v => new Date(v))`**.
  Handlers build the `Date`. This also sidesteps the `Date`-vs-`z.iso.datetime()` trap Part B hits.

Everything else carries over unchanged: `z.uuid()`, `z.coerce.number()` on
`envelopeQuerySchema.sinceEpoch`, the `rekeyPayloadSchema.shape` spreads in `inviteRedeemSchema`
and `removalSchema`, the token-hash regex, the role/platform/policy enums.

### `src/client/index.ts`

```ts
export class TetherApiError extends Error {
  readonly status: number;
  readonly body: unknown;
}

export function createTetherClient(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
}) { ... }
```

One private `request(method, path, body?)` does URL joining,
`content-type: application/json`, `await options.headers?.()` merging, `JSON.stringify`, and
throws `TetherApiError` on non-2xx. Nine thin methods on top: `createDevice`, `listRooms`,
`createRoom`, `listRoomDevices(roomId)`, `removeMember(roomId, body)`, `listEnvelopes(query)`,
`createInvite(roomId, body)`, `lookupInvite`, `redeemInvite`.

Argument types come from `src/types.ts` via **`import type` only** — TS erases them
(`verbatimModuleSyntax` is on), so the runtime graph never reaches zod. Returns `unknown` until
Part B types it. Per `AGENTS.md`, do not annotate return types.

## A.2 Server: declared request schemas

### New `apps/server/src/zod-type-provider.ts` (~20 lines)

```ts
export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this["schema"] extends ZodType ? z.output<this["schema"]> : unknown;
  serializer: this["schema"] extends ZodType ? z.input<this["schema"]> : unknown;
}

export const zodValidatorCompiler: FastifySchemaCompiler<ZodType> = ({ schema }) => (data) => {
  const result = schema.safeParse(data);
  return result.success ? { value: result.data } : { error: result.error };
};

export const zodSerializerCompiler: FastifySerializerCompiler<ZodType> = ({ schema }) => (data) =>
  JSON.stringify(schema.parse(data));
```

The serializer is inert in Part A (fastify only calls it once a `response` schema exists) — it is
groundwork for Part B. **Ship it anyway**; B must not have to add it.

### `apps/server/src/app.ts`

Call `.setValidatorCompiler(zodValidatorCompiler)` and
`.setSerializerCompiler(zodSerializerCompiler)` on the root instance before registering routes;
child plugin contexts inherit both. `setErrorHandler` is **unchanged in Part A**.

### The nine routes

Each route file calls `app.withTypeProvider<ZodTypeProvider>()` locally rather than threading a
shared instance type through every signature. Per route: `preHandler: requireSession` →
`onRequest: requireSession`, add the `schema` block, delete the `.parse()`, decode base64 at the
handler edge.

| Endpoint | File | A declares | B adds (Part B) |
| --- | --- | --- | --- |
| `POST /devices` | `routes/devices.ts` | `body` | `200`, `201` |
| `GET /rooms` | `routes/rooms.ts` | — | `200` |
| `POST /rooms` | `routes/rooms.ts` | `body` | `201` |
| `GET /rooms/:roomId/devices` | `routes/rooms.ts` | `params` | `200` |
| `POST /rooms/:roomId/removals` | `routes/rooms.ts` | `params`, `body` | `200` |
| `GET /envelopes` | `routes/envelopes.ts` | `querystring` | `200` |
| `POST /rooms/:roomId/invites` | `routes/invites.ts` | `params`, `body` | `201` |
| `POST /invites/lookup` | `routes/invites.ts` | `body` | `200` |
| `POST /invites/redeem` | `routes/invites.ts` | `body` | `200` |
| `GET /health` | `routes/health.ts` | — | `200` |

`/api/auth/*` is untouched by both parts.

`runRekey` / `createRoom` in `apps/server/src/rooms/rekey.ts` keep their `Buffer` signatures
(`EnvelopeInput.wrappedKey`, `nameCiphertext`, `displayNameCiphertext`) — **do not change them**;
routes map base64 → `Buffer` before calling in, and `new Date(body.expiresAt)` for invites.

### Files removed / moved

- **Delete** `apps/server/src/routes/schemas.ts`. No test file imports it — only the four route
  files do (`devices.ts:8`, `envelopes.ts:10`, `invites.ts:17`, `rooms.ts:12`).
- **New** `apps/server/src/routes/bytes.ts` with `toBase64(buffer)` (moved verbatim) and
  `fromBase64(value)`. Responses otherwise stay as they are.
- **Remove** `MAX_CIPHERTEXT_BYTES` and `INVITE_MAX_TTL_DAYS` from
  `apps/server/src/constants.ts` — `@tether/api` owns them, and once `schemas.ts` is gone nothing
  else references them (verified by grep). Sweeper/queue constants stay.
- `apps/server/package.json`: add `"@tether/api": "*"` to **dependencies**.

## A.3 Mobile

- `apps/mobile/package.json`: add `"@tether/api": "*"` to dependencies.
- `apps/mobile/tsconfig.json`: add `"customConditions": ["react-native"]` so TS resolves the same
  `src/client/index.ts` Metro bundles. (Expo's base sets `moduleResolution: "bundler"`, which
  supports it. If it misbehaves, the `types` condition falls back to `dist/client/index.d.ts` —
  either satisfies the acceptance criteria, since CI builds `@tether/api` before typecheck.)
- **No `metro.config.js`.** Expo SDK 57 resolves workspace packages from the root `workspaces`
  array and has package exports on by default.
- New `apps/mobile/src/api/client.test.ts` — jest-expo test over an injected fake `fetch`
  asserting method, URL, JSON body, merged `headers()` output, and `TetherApiError` on non-2xx.

## A.4 Guards

**`packages/api/src/purity.test.ts`** — two static checks over `src/**/*.ts`, excluding
`*.test.ts` (the test necessarily contains the strings it searches for):

1. No `Buffer` and no `node:` specifier anywhere in the package.
2. Crawl relative **value** imports (skipping `import type`) from `src/client/index.ts`; assert
   `zod` is unreachable. Source-level, so no build step needed.

**`eslint.config.mjs`** — a block for `packages/api/src/client/**/*.ts` and
`packages/api/src/types.ts` using `@typescript-eslint/no-restricted-imports` with
`paths: [{ name: "zod", allowTypeImports: true }]` plus a pattern banning value imports of
`**/schemas.js`. Disable the base `no-restricted-imports` in the same block, as typescript-eslint
requires.

**`.github/workflows/ci.yml`** — add `- run: npm run build -w @tether/api` immediately after
`npm run build -w @tether/crypto`, i.e. before `npm run typecheck`.

**`apps/server/src/routes/validation.test.ts`** (new file — adding one is allowed, *modifying* an
existing test file is not) pins the two risky mechanics:

- a declared-schema failure still returns 400 with `{ error: "invalid request body", issues: [...] }`;
- an unauthenticated request with a **malformed** body still returns 401, not 400.

## A.5 Commits

1. `feat(api): add @tether/api wire schemas and typed client` — package, its tests first, eslint
   guard, CI build step.
2. `refactor(server): declare route schemas via a zod type provider` — `validation.test.ts` first,
   then the type provider, the nine routes, `bytes.ts`, deleting `schemas.ts`, trimming
   `constants.ts`.
3. `test(mobile): assert @tether/api client request shape` — mobile dep, tsconfig condition,
   jest-expo test.

PR title: `Issue #31: share request schemas and a typed client between the app and the server`.

## A.6 Verification

```bash
docker compose up -d
npm run build -w @tether/crypto && npm run build -w @tether/api
npm run typecheck                         # includes -w mobile: must surface no Node globals
npm run db:push -w server
npm test -w @tether/api && npm test -w server && npm test -w mobile
npm run lint && npm run format:check
```

Then by hand:

- `git diff --name-only main -- 'apps/server/src/**/*.test.ts'` lists **only** the new
  `validation.test.ts`. If any existing test moved, the mechanics are wrong — stop and rethink.
- `grep -rn "\.parse(" apps/server/src/routes/` returns nothing.
- `grep -rn "Buffer" packages/api/src/` returns nothing.

---

# Part B — Issue #32: response schemas and error codes

> Agent B. Branch `refactor/32-response-schemas` off `refactor/31-shared-api-contract`.
> Unlike Part A, **existing test files will change** — response shapes are moving on purpose.

## B.1 `packages/api/src/responses.ts` (new file)

Every field is an explicit wire type; no Drizzle row is spread. Nullable columns use
`.nullable()`, **never `.optional()`** — `JSON.stringify` absorbed `null`, zod does not.

- `deviceResponseSchema` — `id`, `identityPublicKey` (base64), `platform`, `createdAt`
  (`z.iso.datetime()`), `lastSeenAt` (`z.iso.date()` — the column is `date({ mode: "string" })`),
  `revokedAt` (`z.iso.datetime().nullable()`). **No `userId`, no `pushToken`.**
- `roomSummarySchema` — `roomId`, `currentEpoch`, `nameCiphertext` (base64), `nameEpoch`,
  `precisionPolicy`, `approximateRadiusM`, `memberAlias`, `role`, `joinedEpoch`. **No `ownerId`,
  no `createdAt`/`updatedAt`.**
- `roomListResponseSchema` — `{ rooms: roomSummarySchema[] }`
- `roomDevicesResponseSchema` — `{ epoch, devices: [{ deviceId, identityPublicKey }] }`
- `rekeyResultSchema` — `{ newEpoch }` (used by `POST /rooms/:roomId/removals`)
- `envelopeListResponseSchema` — `{ envelopes: [{ roomId, epoch, wrappedKey }] }`
- `inviteResponseSchema` — `id`, `roomId`, `grantsRole`, `wrappedRoomKey`, `wrappedRoomKeyEpoch`,
  `createdAt`, `expiresAt`, `redeemedAt` (nullable), `revokedAt` (nullable). **No `tokenHash`, no
  `createdBy`.**
- `inviteLookupResponseSchema` — `{ roomId, grantsRole, wrappedRoomKey, wrappedRoomKeyEpoch, expiresAt }`
- `redeemResponseSchema` — `{ newEpoch, roomId, memberAlias }`
- `healthResponseSchema` — `{ status: z.literal("ok") }`

`POST /rooms` returns `roomSummarySchema` **bare** — the `{ room, memberAlias }` envelope is gone
(confirmed decision 5). `memberAlias`, `role` and `joinedEpoch` come from the membership row
created alongside the room.

## B.2 `packages/api/src/errors.ts` (new file)

```ts
export const ERROR_CODES = [
  "invalid_request",         // 400 — schema validation
  "wrap_set_mismatch",       // 400
  "unauthorized",            // 401
  "forbidden",               // 403
  "not_found",               // 404
  "stale_epoch",             // 409
  "room_exists",             // 409
  "already_member",          // 409
  "device_already_registered", // 409
  "internal",                // 500
] as const;

export const errorResponseSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
```

Validation 400s carry `details.fields: [{ path, message }]` derived from `ZodError.issues` —
`path` joined with `"."`, `message` taken straight from the issue. Raw `ZodIssue[]` never reaches
a client.

Re-export `responses.ts` and `errors.ts` from `packages/api/src/index.ts`. Response **types** go
in `types.ts` as `z.infer` aliases next to the request ones.

## B.3 `apps/server/src/errors.ts`

Give `HttpError` a `readonly code: ErrorCode` (imported from `@tether/api`) and thread it through
every subclass. Map the existing throw sites:

| Throw site | Status | Code |
| --- | --- | --- |
| `UnauthorizedError` (`auth/session.ts`) | 401 | `unauthorized` |
| `ForbiddenError` × 4 (invites, rooms) | 403 | `forbidden` |
| `NotFoundError` × 5 | 404 | `not_found` |
| `StaleEpochError` (`rooms/rekey.ts`) | 409 | `stale_epoch` |
| `WrapSetMismatchError` (`rooms/rekey.ts`) | 400 | `wrap_set_mismatch` |
| `ConflictError("roomId already exists")` | 409 | `room_exists` |
| `ConflictError("already an active member of this room")` | 409 | `already_member` |
| `ConflictError("identityPublicKey already registered to another user")` | 409 | `device_already_registered` |

The three `ConflictError` call sites become three named subclasses so the code is set at the throw
site, not guessed from the message. `details` stays **nested** — `StaleEpochError`'s
`{ expectedEpoch, currentEpoch }` and `WrapSetMismatchError`'s `{ missing, extra, duplicate }`
move under `details`, no longer spread onto the body.

## B.4 `apps/server/src/app.ts`

**Rewrite `setErrorHandler`** to emit `{ code, message, details? }`:

- `ZodError` → 400 `invalid_request`, `message: "invalid request body"`, `details.fields`.
- `HttpError` → `error.status`, `error.code`, `error.message`, `details: error.details`.
- anything else → 500 `internal`, `message: "internal server error"`, and keep the existing
  `request.log.error(error)` and the comment explaining why a driver message must never reach a
  client.

**Add an `onRoute` hook** that injects the shared error schema into every route:

```ts
app.addHook("onRoute", (routeOptions) => {
  const response = { ...routeOptions.schema?.response };
  response["4xx"] ??= errorResponseSchema;
  response["5xx"] ??= errorResponseSchema;
  routeOptions.schema = { ...routeOptions.schema, response };
});
```

This is the fix for the fail-open: `getSchemaSerializer` falls back to `<n>xx` before giving up
(`schemas.js:168`), and `onRoute` runs before serializer compilation (`route.js:295` vs `:437`).
Without it a status code with no declared schema silently reverts to raw `JSON.stringify` — which
is exactly how an undeclared field would sneak back onto the wire.

> Careful: the hook applies to `/api/auth/*` too. That route sends better-auth's own body through
> `reply.send(await response.text())` — a **string**, which fastify does not serialize. Confirm
> with a test that auth still round-trips; if not, skip injection for routes whose url starts
> `/api/auth`.

## B.5 Route handlers

Add `schema: { response: { ... } }` per the table in §A.2, then fix the payloads:

- **`POST /devices`** — declare **both `200` and `201`** with `deviceResponseSchema`. This is the
  case #32 calls out: the same body at two status codes, where a partial map would fail open on
  one of them. Replace `serializeDevice`'s `{ ...row }` spread with an explicit projection.
- **`GET /rooms` / `POST /rooms`** — both build a `RoomSummary`. `POST /rooms` returns it bare.
  `createRoom` in `rooms/rekey.ts` returns the room row only, so the handler composes the
  membership half (`memberAlias` it already generates, `role: "owner"`, `joinedEpoch: 0`).
- **`POST /rooms/:roomId/invites`** — explicit projection dropping `tokenHash` and `createdBy`.
- **`POST /invites/lookup`** — `expiresAt` is a Drizzle `Date`; send `row.expiresAt.toISOString()`.
- Everywhere a nullable timestamp is returned: `row.revokedAt?.toISOString() ?? null`.

**The two encode traps, restated as rules:** the serializer runs `schema.parse(payload)`, so a
`Date` against `z.iso.datetime()` throws `ResponseSerializationError` (→ 500), and `null` against
`.optional()` does the same. Convert dates in the handler; use `.nullable()` for nullable columns.

## B.6 Tests

Existing files that must be updated (this is expected):

- **`apps/server/src/test-helpers.ts`** — delete the hand-declared `DeviceResponse` and
  `RoomCreateResponse` interfaces; import the types from `@tether/api` instead.
- **`rooms.test.ts` / `invites.test.ts`** — `created.room.id` becomes `created.roomId` after the
  `POST /rooms` flattening.
- **`routes/validation.test.ts`** (created by A) — update to the new error body.

New assertions:

- `POST /devices` returns no `userId` and no `pushToken` at **both 200 and 201** — hit the route
  twice with the same `identityPublicKey`.
- `POST /rooms/:roomId/invites` returns no `tokenHash` and no `createdBy`.
- `GET /rooms` and `POST /rooms` produce the same key set; neither carries `ownerId`.
- A 409 stale-epoch body is `{ code: "stale_epoch", message, details: { expectedEpoch, currentEpoch } }`.
- A validation 400 carries `details.fields` and **no** `issues` key.
- A route that returns a `Date` (`POST /invites/lookup`) and one that returns a `null` timestamp
  (`POST /devices` → `revokedAt`) both serialize rather than 500.
- `/api/auth/*` still round-trips under the `onRoute` hook.

## B.7 Commits

Errors are the riskiest change and get their own commit, as #32 requires:

1. `feat(api): add response and error schemas to @tether/api`
2. `refactor(server): declare response schemas on every route` — §B.5 plus the response half of
   the tests.
3. `refactor(server): give error bodies a stable code` — §B.3, §B.4, the `onRoute` hook, the
   error-shape tests.

PR title: `Issue #32: stop returning raw database rows and give errors machine-readable codes`.

## B.8 Verification

Same command sequence as §A.6, plus:

- `npm run typecheck -w mobile` **fails** when a `responses.ts` field is renamed — the proof that
  mobile is bound to the contract. Verify by renaming a field, running it, and reverting.
- `grep -rn "\.\.\.row\|\.\.\.created\|\.\.\.existing" apps/server/src/routes/` returns nothing —
  no route spreads a Drizzle row any more.
- Every route in the §A.2 table has an explicit success-status entry under `response`; the
  `onRoute` hook covers `4xx`/`5xx`.

---

## Global constraints (both agents)

From `AGENTS.md`:

- Branch before touching anything; TDD — tests before implementation.
- **Never run a dev server.** Builds and injected-`fetch` tests are the verification.
- `npm run format && npm run lint && npm test` before every commit; conventional commits.
- No verbose comments; concise one-liners only where the code cannot explain itself.
- No `undefined` where avoidable, no `any`, no `as` casting, no explicit return types.
- `db:push` against local docker compose only — never write a migration.
- Invariants that constrain this work: `fix` / `precision_request` / `precision_grant` reference
  aliases, never user IDs (so `memberAlias` stays on the wire and `userId` comes off it); nothing
  logs an IP or user agent (`app.test.ts` guards this — do not touch the logger serializers).
