# PR #28 — Adversarial review findings

Scope: `feat/3-server-skeleton-and-auth` @ `b02b5d5`, diffed against `main`.
Reviewed by adversarial read plus empirical probes against the installed Fastify 5.12.1 / Node 24.

CI on this branch is **green**, so every claim below is either (a) empirically reproduced, or (b) explicitly
marked `VERIFY` — meaning it is a suspicion the reviewer could not settle without `better-auth` installed.
Do not "fix" a `VERIFY` item until you have confirmed it; some of them may be correct as written.

Section E lists things that look wrong but are **provably fine**. Read it before touching that code so you
don't re-introduce a non-bug.

Rough budget: Section B removes **~150 lines** of production and test code with no behaviour change.

---

## A. Bugs

### A1 — Apple Sign In callback returns 415 and can never complete `[CONFIRMED]`

`apps/server/src/routes/auth.ts:29` mounts `/api/auth/*`, but the app registers no
`application/x-www-form-urlencoded` body parser. Fastify ships parsers for `application/json` and
`text/plain` only, so a urlencoded POST is rejected with 415 *before* the handler runs.

Apple's OAuth uses `response_mode=form_post`: the identity provider POSTs the authorization result to
`/api/auth/callback/apple` as `application/x-www-form-urlencoded`. That request never reaches
`auth.handler`.

Reproduced against this exact route shape:

```
POST /api/auth/callback/apple  content-type: application/x-www-form-urlencoded
-> 415 {"statusCode":415,"code":"FST_ERR_CTP_INVALID_MEDIA_TYPE",...}
```

There is a second, compounding defect on the same path. `routes/auth.ts:22` re-serialises **every** body as
JSON:

```ts
body: hasBody && request.body ? JSON.stringify(request.body) : null,
```

while the original `content-type` is copied through verbatim at lines 8-14. Even with a urlencoded parser
registered, Better Auth would receive a JSON body labelled `application/x-www-form-urlencoded` and fail to
parse it. Both halves must be fixed together.

`plugins.test.ts` does not catch this: its only social-provider test asserts the *authorization URL* is
built (`google.json().url`), which is the outbound leg. No test drives the inbound callback for Apple.

Fix, preferred: delete `toWebRequest` and mount Better Auth's official Node/Fastify handler, which owns this
bridge and its edge cases (see B7 — this is also the single largest deletion in the PR).
Fix, minimal: register `@fastify/formbody`, and pass the raw body through instead of re-encoding it — add a
content-type-preserving parser, or read the raw payload rather than the parsed object.

### A2 — Request URL is built from an unvalidated `Host` header on a hardcoded `http://` scheme

`apps/server/src/routes/auth.ts:6`:

```ts
const url = new URL(request.url, `http://${request.headers.host}`);
```

Two problems.

The scheme is hardcoded `http`. In production behind a TLS-terminating proxy, every request Better Auth sees
claims to be plaintext HTTP. Anything deriving an origin, a redirect, or a cookie `Secure` decision from the
request URL rather than from `baseURL` will get it wrong.

The authority is attacker-controlled. `trustProxy: false` (`app.ts:24`) is correctly set so Fastify won't
trust `X-Forwarded-*`, but `Host` is not `X-Forwarded-*` — it is copied straight in. Impact is currently
limited because `baseURL` is set explicitly (`auth.ts:11`) and `trustedOrigins` is enforced, so this is
defence-in-depth rather than a live exploit — but it is a standing hazard and it is free to remove.

Also note `request.headers.host` is optional in Fastify's types; if absent the code silently constructs
`http://undefined`.

Fix: build the URL from `env.BETTER_AUTH_URL`, which is already validated as a URL by zod and is the value
Better Auth treats as authoritative anyway. This deletes the dependency on the inbound `Host` entirely.

### A3 — Missing OAuth credentials silently mount a broken provider

`apps/server/src/env.ts:9-13` defaults all five provider credentials to `""`:

```ts
GOOGLE_CLIENT_ID: z.string().default(""),
GOOGLE_CLIENT_SECRET: z.string().default(""),
APPLE_CLIENT_ID: z.string().default(""),
APPLE_CLIENT_SECRET: z.string().default(""),
APPLE_APP_BUNDLE_IDENTIFIER: z.string().default(""),
```

`auth.ts:56-72` then registers Google and Apple unconditionally. A deploy that forgets
`GOOGLE_CLIENT_SECRET` boots clean and advertises a working Google sign-in that fails at the token exchange —
the failure surfaces to end users mid-flow instead of at startup. `.env.example` ships these keys blank,
which makes the misconfiguration the default state rather than an unlikely one.

The env schema is also happy with a half-configured provider: client ID set, secret blank.

Fix: register each social provider only when its credentials are present, and validate them as a group
(zod `superRefine`: if `GOOGLE_CLIENT_ID` is set then `GOOGLE_CLIENT_SECRET` is required, and likewise for
Apple's three). Fail at boot, not at callback.

### A4 — Postgres connection pool is never closed on shutdown

`apps/server/src/db/client.ts:7` opens a `pg.Pool` at module scope. `server.ts:9-15` handles SIGTERM/SIGINT
by closing the Fastify app but never calls `pool.end()`, so shutdown leaves the pool open and the process
relies on `process.exit(0)` to tear down sockets. In-flight queries are cut rather than drained, and a
container that is stopped and restarted repeatedly can leave server-side connections lingering until
Postgres times them out.

The same handler swallows failures: `app.close().then(() => process.exit(0))` has no `.catch`, so a
rejected close produces an unhandled rejection and the process never exits — the orchestrator has to
SIGKILL it.

Fix: export the pool, `await` both `app.close()` and `pool.end()`, and add a `.catch` that exits non-zero.

### A5 — `VERIFY` — passkey `credentialID` is indexed but not unique

`apps/server/src/db/schema/auth.ts:104` declares:

```ts
index("passkey_credentialID_idx").on(table.credentialID)
```

Better Auth's own passkey schema treats `credentialID` as unique. A non-unique column permits two rows with
the same credential ID, at which point authentication lookups by credential ID are ambiguous and resolve by
whatever order the planner returns.

Confirm against the `@better-auth/passkey` schema, then promote to `uniqueIndex` if it matches. Flagged
`VERIFY` rather than `CONFIRMED` because the package is not installed in this checkout.

### A6 — `?? ""` fallbacks convert missing values into silently-wrong queries

`apps/server/drizzle.config.ts:7` — `url: process.env.DATABASE_URL ?? ""` turns a missing env var into a
cryptic driver error instead of a clear one. `env.ts` already validates `DATABASE_URL`; import it.

`auth.test.ts:110,118` — `eq(accountTable.userId, user?.id ?? "")`. If the user row is missing, this queries
for `userId = ""`, returns nothing, and the failure surfaces as a confusing assertion about a null token
rather than "no user was created". Assert the user exists first and use a non-optional binding.

This pattern also runs against the house rule in `AGENTS.md` — *avoid `undefined` as much as possible*.

---

## B. Deletions — ~150 lines removable with no behaviour change

Ordered by confidence. B1-B3 are verified dead or verified redundant; take those first.

### B1 — Delete four unused `relations()` blocks `[CONFIRMED]` — ~30 lines

`apps/server/src/db/schema/auth.ts:112-138` exports `userRelations`, `sessionRelations`, `accountRelations`
and `passkeyRelations`. Nothing consumes them. Verified by searching the whole server source for `db.query`
and `Relations` outside the schema file: **zero hits**. Drizzle's relational query API is the only consumer
of `relations()`, and the PR never uses it — every query is `db.select()`.

Delete all four exports and drop `relations` from the `drizzle-orm` import on line 1. Re-add when a
`db.query.*` call actually needs them.

### B2 — Delete the `session.ip_address` / `session.user_agent` columns and their write hook — ~14 lines

The repo invariant is *nothing writes an IP address or user agent*. The PR currently upholds this at
runtime, with three overlapping mechanisms: `disableIpTracking` (`auth.ts:16-18`), a
`databaseHooks.session.create.before` that nulls both fields (`auth.ts:108-120`), and `trustProxy: false`.
But the columns still exist (`schema/auth.ts:36-37`), so the guarantee is only as good as the hook.

Deleting the columns converts a runtime promise into a schema-level impossibility: a future Better Auth
version, a new plugin, or a careless hook edit then *cannot* persist either value — the insert fails loudly
instead of quietly storing PII. That is strictly stronger than the current arrangement and removes code.

Once the columns are gone, `databaseHooks.session` (`auth.ts:108-120`) has nothing left to null and can go
too. Keep `disableIpTracking: true` — it stops Better Auth resolving a client IP in the first place, which
is upstream of storage.

`VERIFY` the Drizzle adapter tolerates the absent columns — Better Auth may pass `ipAddress`/`userAgent` keys
on insert regardless. If it does and the adapter rejects unknown keys, keep the hook and drop only the
columns, or keep both and document why in one line.

### B3 — Collapse four privacy layers into one — ~36 lines

The PR description presents "four independent layers" as a feature. Adversarially, it is one guarantee paid
for four times, and three of the four are conditional while one is not.

| Layer | Location | Lines | Covers |
|---|---|---|---|
| `additionalFields` overrides | `auth.ts:24-48` | ~25 | new users only, via `defaultValue` |
| `mapProfileToUser` ×2 | `auth.ts:60-63, 69-72` | ~8 | Google and Apple only |
| `databaseHooks.user.create.before` | `auth.ts:76-90` | ~15 | **every** user insert, every provider |
| `disableIpTracking` | `auth.ts:16-18` | 3 | IP resolution |

`databaseHooks.user.create.before` sits at the last write barrier and unconditionally overwrites `name`,
`email`, `image` and `emailVerified` for every provider — including providers added later by someone who
never reads this file. It strictly subsumes the other two identity layers.

`mapProfileToUser` is the clearest liability: it is per-provider and already duplicated verbatim twice. Add
a third provider and the layer silently stops covering it, with no test failure — `auth.test.ts` only
exercises Google.

`additionalFields` re-declaring `name`, `email` and `image` is the most doubtful of the three. These are
Better Auth *core* user fields, not additional ones; re-declaring core fields through `additionalFields` is
not a documented pattern and may be partly ignored. The `image` entry (`auth.ts:42-47`) has
`required: false`, `input: false` and no `defaultValue` — it cannot do anything the hook doesn't already do.

Proposed: delete `additionalFields` and both `mapProfileToUser` callbacks. Keep the hook and
`disableIpTracking`.

**This is a safe deletion to attempt because `auth.test.ts` is the exact oracle for it.** That test asserts
on the *written rows*, which is precisely what the hook guarantees. Delete the layers and run it:

- Test still passes → the layers were redundant by construction. Deletion confirmed.
- Test fails → you have learned which layer actually does the work, which is information the current code
  hides. Keep that layer, delete the rest.

Either outcome is a win. Do not skip running it.

### B4 — Fold `trustedOrigins()` into the zod schema — ~10 lines

`env.ts:27-33` exports a helper that splits a comma string, called at `app.ts:29` and `auth.ts:13` on the
same env var. Every call re-parses the same constant string.

```ts
TRUSTED_ORIGINS: z.string().min(1).transform((v) =>
  v.split(",").map((o) => o.trim()).filter(Boolean),
),
```

`env.TRUSTED_ORIGINS` becomes `string[]` at both call sites. Deletes the helper, its export, both imports
and the repeated parse.

### B5 — `syntheticName()` becomes a constant — ~4 lines

`synthetic-identity.ts:5,7-9` wraps a fixed string in a function purely to satisfy `defaultValue`'s callback
signature. After B3 removes `additionalFields`, the only remaining caller is the hook, which can read a
plain `const SYNTHETIC_NAME`. `syntheticEmail()` must stay a function — it must return a fresh UUID per call.

### B6 — `VERIFY` — drop unused auth columns

Not yet confirmed; each needs a check against Better Auth's adapter before removal.

- `account.password` (`schema/auth.ts:61`) — `emailAndPassword` is **not configured** in `auth.ts`
  (confirmed: no `emailAndPassword` key, no `password` reference anywhere in the auth config). The column
  can never be populated by this configuration.
- `user.image` (`schema/auth.ts:17`) — Tether never stores an avatar; the hook nulls it on every insert.
  Deleting the column is the same argument as B2: make it impossible rather than merely nulled.
- `user.emailVerified` (`schema/auth.ts:16`) — always written `false`, and with no email flow it has no
  reader.
- `verification` table (`schema/auth.ts:87-97`) — check whether the passkey plugin uses it for challenge
  storage before touching this one. Most likely **keep**.

Treat these as four independent checks, not one change.

### B7 — Delete `toWebRequest` in favour of the official adapter — ~25 lines

`routes/auth.ts:5-26` hand-rolls a Fastify→Web `Request` bridge. It is the least-tested and most
bug-dense code in the PR: A1 and A2 both live inside it, and it has no direct test of its own (see C4).

Better Auth ships a Node/Fastify integration that owns this conversion. Adopting it deletes the function,
deletes both bugs, and deletes the class of bug — body encoding, header forwarding, method coverage,
response streaming — rather than patching two instances of it.

`VERIFY` the adapter's exact name and import path against the installed `better-auth@^1.7.2`.

### B8 — Minor removals

- `auth.ts:21-23` — `user.changeEmail.enabled: false`. `VERIFY` against Better Auth's defaults; if
  `changeEmail` is already disabled by default this is a no-op. Same check for
  `account.updateAccountOnSignIn: false` and `accountLinking.enabled: false` (`auth.ts:50-55`) — delete
  whichever merely restate a default, keep any that genuinely flip one.
- `vitest.setup.ts` — the whole file exists to preload `.env` because `env.ts:24` runs `loadEnv()` at import
  time. `node --env-file-if-exists` in the test script, or vitest's `test.env`, would replace it. Low
  priority; see D2 — its comment is one of the good ones.

---

## C. Tests

### C1 — `env.test.ts` tests zod, not Tether — delete the file (~30 lines)

All three cases assert library behaviour: that a `z.url()` field rejects absence, and that `.min(32)`
rejects a 9-character string. If any of these ever fail, zod is broken, not this repo. They will never catch
a Tether regression.

The one piece of genuine project logic in `env.ts` — comma-splitting `TRUSTED_ORIGINS` — has **no test at
all**. After B4 folds it into a `.transform()`, replace this file with a single case asserting
`" a , ,b "` parses to `["a","b"]`. Net: -30 lines, +5, and the coverage moves onto code that can actually
break.

### C2 — `synthetic-identity.test.ts` first block is a change-detector — delete (~6 lines)

```ts
expect(syntheticName()).toBe(syntheticName());
expect(syntheticName()).toBe("tether user");
```

The first line asserts a pure function returning a literal is deterministic. The second restates the
implementation constant, so changing the string fails the test by construction — it pins a value without
defending a behaviour. After B5 makes this a `const`, the block is asserting that a constant is constant.

The `syntheticEmail` block **earns its place** and must stay: uniqueness across calls and the
`.invalid` domain are both real, load-bearing properties (`.invalid` is reserved by RFC 2606 and
guarantees the address is unroutable — that is a privacy property worth a test).

### C3 — `plugins.test.ts` third case tests the library — collapse (~20 lines)

"mounts the Google and Apple social sign-in endpoints" asserts that Better Auth builds an authorization URL
containing `accounts.google.com` / `appleid.apple.com`. That is the library's URL construction, driven by
CI placeholder credentials (`ci-google-client-id`).

Its only real signal is "the provider is configured and the route is mounted", which `auth.test.ts` already
proves end-to-end for Google. Keep a single smoke assertion if you want the Apple mount covered, and note
that a test asserting the Apple *callback* works would have caught A1 — that is the test worth writing here.

### C4 — The riskiest code in the PR has no test `[gap]`

`toWebRequest` is untested. No test sends a urlencoded body, a non-JSON content type, a `HEAD` or `OPTIONS`
request, or a response carrying multiple `Set-Cookie` headers through the route. A1 is a direct consequence:
one urlencoded POST test would have caught it.

If B7 lands, this gap closes by deletion. If it does not, add those cases.

### C5 — `auth.test.ts` success assertion is too weak to fail

`auth.test.ts:99` — `expect(callback.statusCode).toBeLessThan(400)`.

Better Auth signals OAuth callback failure by **redirecting to its error URL with a 302**, which passes this
assertion. The test is only saved from a false green by the later row assertions.

Assert the redirect target instead: `Location` should be the success `callbackURL` and must not contain
`error`. This matters more than it looks — this is the acceptance test the PR description leans on as
evidence the privacy layers work, so it should not be able to pass on a failed sign-in.

### C6 — Fastify instances leak on assertion failure

`auth.test.ts:96` and `plugins.test.ts` (3 sites) call `await app.close()` inline in the test body. Any
assertion that throws earlier skips the close and leaks the instance for the rest of the run. Move to
`afterEach`, or `try/finally`.

### C7 — `fileParallelism: false` is unexplained

`vitest.config.ts:6` serialises the entire suite. The reason is real — `truncateAuthTables()` in a global
`beforeEach` means any two concurrent DB test files would truncate each other's rows — but it is nowhere
recorded, so a future reader may "optimise" it away and get flaky tests.

This is the one place in the PR that genuinely needs a comment (see D). One line: `// DB tests share one
database; truncation in beforeEach means files cannot run concurrently.`

### C8 — `as` cast violates the house style

`plugins.test.ts:30` — `response.json() as { user: { id: string; email: string } }`. `AGENTS.md` bans `as`
casting. Use a zod parse or a typed helper.

---

## D. Comments

The house rule is: no verbose comments; a comment must explain *why*, not *what*. The PR is close to clean —
there are only two comments in the whole server source, and one of them is fine.

### D1 — Delete four `/* @__PURE__ */` annotations

`schema/auth.ts:21,34,64,83` — `.$onUpdate(() => /* @__PURE__ */ new Date())`.

Drizzle-kit codegen noise, pasted in four times. `@__PURE__` marks a call as side-effect-free so a bundler
may drop it when its result is unused — meaningless here: the value is the callback's return value, always
used, and this is server code that is never tree-shaken. It explains nothing and is not a *why*. Delete all
four; the expression is identical without it.

### D2 — Keep the `vitest.setup.ts` comment

`vitest.setup.ts:6` — `// .env is optional locally when running against CI-provided env vars`.

This is exactly the comment the rule asks for: it explains *why* an empty `catch` block is intentional
rather than swallowed sloppiness. **Do not delete it.** Noted explicitly because a mechanical sweep for
"comments in a catch block" would remove it.

### D3 — Add one comment

C7's `fileParallelism: false`. Currently a bare config flag whose reason lives only in the author's head.

---

## E. Verified NOT issues — do not "fix" these

Each was suspected during review and disproved by running it. Left here so the next reader doesn't burn time
on the same false leads, or "fix" working code.

1. **`Set-Cookie` merging in `routes/auth.ts:32-34`.** Copying response headers via `Headers.forEach` +
   `reply.header()` looks like it should collapse multiple cookies into one comma-joined header — the
   classic version of this bug. It does not, for two independent reasons, both confirmed on Node 24 /
   Fastify 5.12.1: `Headers.forEach` yields `set-cookie` as **separate entries** (per the amended fetch
   spec), and Fastify's `reply.header()` **special-cases `set-cookie` by accumulating into an array**
   instead of overwriting. Multi-cookie responses — which the OAuth state/verifier/session flow relies on —
   pass through correctly.

   Worth knowing: `reply.header()` **overwrites** for every *other* duplicate header name. Confirmed: two
   `x-dup` writes yield only the last. Not currently a bug (Better Auth sends no other duplicated headers),
   but it constrains any future edit to this loop.

2. **Stale `content-length` truncating responses.** The header loop copies `content-length` from the
   upstream `Response` while `reply.send()` re-serialises the body, which looks like a truncation bug.
   Fastify recomputes it — a deliberately wrong `content-length: 5` on a 48-byte body was corrected to 48,
   body intact.

3. **`account.issuer` `notNull()` with no default (`schema/auth.ts:53`).** `issuer` is not part of Better
   Auth's documented core account schema, so a `notNull()` column the ORM never populates should fail every
   account insert. CI is green and `auth.test.ts:109-115` asserts on a real written account row, which is
   only reachable if the insert succeeded — so Better Auth 1.7 does populate it. Leave it alone. The same
   evidence covers the `uniqueIndex(issuer, accountId)`.

4. **`trustProxy: false` (`app.ts:24`).** Correct and deliberate — it stops Fastify honouring
   `X-Forwarded-For`, which is what keeps `app.test.ts`'s no-IP-in-logs assertion true. Do not enable it to
   "fix" A2; A2 is about the `Host` header, which is a different header and unaffected by this setting.

---

## F. Suggested order

1. **A1** — the only user-visible breakage; Apple sign-in cannot complete today.
2. **B1** — 30 lines of verified dead code, zero risk.
3. **B7** — deletes `toWebRequest`, which resolves A1 and A2 structurally. If it lands, fix A1 that way
   rather than patching. If it does not, fix A1 and A2 by hand.
4. **B3** — run `auth.test.ts` before and after; the result is informative either way.
5. **A3, A4** — configuration and shutdown correctness.
6. **B2, B4, B5** — deletions.
7. **C1-C8, D1, D3** — test and comment cleanup.
8. **A5, B6, B8** — the `VERIFY` items, once `better-auth` is installed and its schema can be read.

Re-run `npm run format && npm run lint && npm run typecheck && npm test` after each group. The DB tests need
`docker compose up -d postgres && npm run db:push -w server` first.
