# ISSUES

Review of branch `feat/mobile-remove-web-deps` (commit `6a17233` "Remove web-only deps from mobile app", diffed against `b05ac81`).

**What the branch does:** removes `react-dom` and `react-native-web` from `apps/mobile/package.json`, drops the `web` script, removes the `expo.web` block from `apps/mobile/app.json`, and prunes 18 packages from `package-lock.json`.

**Verification performed:** after pruning `node_modules` to match the committed lockfile, `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm test` all pass, and the server builds and serves `GET /health` correctly. The core removal is sound — `react-dom` and `react-native-web` are *optional* peer dependencies of `expo-router` and `expo-image`, so native builds are unaffected.

The issues below are things the branch left in an inconsistent state, plus pre-existing problems found along the way.

---

## Blocking — introduced by this branch

### 1. `web` is still an active Expo platform, so web builds now hard-fail

**Files:** `apps/mobile/app.json`

Removing the `expo.web` block does **not** disable the web platform. Expo still resolves the platform list to `["ios","android","web"]` (confirmed via `expo config --type public --json`). Because `react-native-web` is now gone, any web build fails outright:

```
$ npx expo export --platform web
CommandError: It looks like you're trying to use web support but don't have the required
dependencies installed.

Install react-native-web@^0.21.2 by running:
  npx expo install react-native-web

If you're not using web, please ensure you remove the "web" string from the
platforms array in the project Expo config.
```

`expo start` will also still offer web as a target, which now dead-ends.

**Fix:** declare the supported platforms explicitly in `apps/mobile/app.json`, inside the `expo` object:

```json
"platforms": ["ios", "android"],
```

This is the fix Expo's own error message asks for, and it makes the branch's intent enforced rather than implicit.

---

## Non-blocking — introduced by this branch

### 2. `favicon.png` is now an orphaned asset

**Files:** `apps/mobile/assets/images/favicon.png`

`app.json`'s `web.favicon` was the only reference to this file; a repo-wide grep for `favicon` now returns zero hits. Delete it.

While in there, `apps/mobile/assets/images/tutorial-web.png` is also unreferenced (Expo template leftover) and can go in the same cleanup.

### 3. Dead `web-build/` entry in the mobile gitignore

**Files:** `apps/mobile/.gitignore` (line 9)

`web-build/` can no longer be produced by this app. Remove the line.

### 4. The commit message overstates the result — `react-dom` is still installed

**Files:** `package-lock.json` (informational; no code change required)

`react-dom@19.2.3` remains in the dependency tree as a **transitive** dependency, pulled in by `expo-router` → `vaul` → `@radix-ui/*`, and by `@expo/ui` and `@expo/metro-runtime`. It is still present in the lockfile at `node_modules/react-dom`.

Only `react-native-web` and its subtree (17 packages: `fbjs`, `inline-style-prefixer`, `node-fetch`, `styleq`, `css-in-js-utils`, etc.) were actually removed from the install.

No action needed beyond not assuming `react-dom` is gone — if a follow-up task is "eliminate react-dom", it cannot be done by editing `apps/mobile/package.json` alone.

### 5. Local `node_modules` drifts from the committed lockfile — risk of false-green reviews

**Files:** none (process issue)

The commit updated `package-lock.json` but the working checkout's `node_modules` still contained all 18 removed packages. Running the test suite in the repo as-checked-out therefore passes *while `react-native-web` is still on disk*, which does not prove the change is safe. `npm install --dry-run` reports `removed 18 packages`.

Anyone validating this branch must run `npm install` (or `npm ci`) first. This is the strongest argument for issue #7 below.

---

## Pre-existing — not introduced by this branch, found during review

### 6. `npm run reset-project` fails — the script file does not exist

**Files:** `apps/mobile/package.json` (`scripts.reset-project`)

The script runs `node ./scripts/reset-project.js`, but `apps/mobile/scripts/` does not exist. Confirmed:

```
npm error command sh -c node ./scripts/reset-project.js
EXIT: 1
```

**Fix:** remove the script entry (the Expo template's `scripts/` directory was evidently dropped when `src/` was introduced), or restore the file if the reset workflow is wanted.

### 7. No CI — nothing enforces lint / typecheck / test / format

**Files:** no `.github/` directory exists

The repo has working `lint`, `format:check`, `typecheck`, and `test` scripts at the root, but nothing runs them. A regression of exactly the kind in issue #1 (works locally on a stale `node_modules`, breaks on a clean install) would ship unnoticed.

**Fix:** add a workflow that runs `npm ci` (not `npm install`) followed by the four root scripts. Using `npm ci` is the part that matters — it is what would have caught issue #5.

### 8. Server tests are never typechecked

**Files:** `apps/server/tsconfig.json`

`include` is `["src/**/*.ts"]` and `exclude` lists `test`, so `apps/server/test/health.test.ts` is outside the scope of `npm run typecheck`. Type errors in server tests are invisible until runtime.

Note the mobile app does not have this problem — its `tsconfig.json` uses `include: ["**/*.ts", "**/*.tsx", ...]`, which picks up `src/app/index.test.tsx`.

**Fix:** add a `tsconfig.test.json` covering `test/**/*.ts`, or widen the main config's `include` and keep `noEmit` behaviour for tests via a separate build config.

### 9. ESM-style import specifiers compiled as CommonJS

**Files:** `apps/server/package.json`, `apps/server/src/*.ts`

Source uses explicit `.js` extension specifiers (`import { buildApp } from "./app.js"`), which is the ESM idiom, but `apps/server/package.json` has no `"type": "module"`. With `module: "NodeNext"`, TypeScript therefore emits CommonJS — the built `dist/server.js` starts with `"use strict"; ... require("./app.js")`.

This **works today** (verified: build succeeds, `node dist/server.js` serves `GET /health` → `{"status":"ok"}`), because the `.js` specifiers happen to resolve under CJS too. But it is a latent trap: the code reads as ESM and will behave differently the moment `"type": "module"` is added, or if a true ESM-only dependency is introduced.

**Fix:** decide deliberately — either add `"type": "module"` to `apps/server/package.json` (matching the existing import style), or drop the `.js` extensions to make the CommonJS intent explicit. The former is the better default for a new Node service.

### 10. `pino-pretty` is a production dependency but only used in development

**Files:** `apps/server/package.json`, `apps/server/src/app.ts:8`

The transport is only wired when `process.env.NODE_ENV === "development"`, so `pino-pretty` ships in production installs for no reason.

**Fix:** move it to `devDependencies`. Verify the production path still starts cleanly, since Fastify resolves the transport target lazily and it is `undefined` outside development.

### 11. No graceful shutdown in the server entrypoint

**Files:** `apps/server/src/server.ts`

Nothing handles `SIGTERM`/`SIGINT`, so in-flight requests are dropped on deploy or container stop. Minor for a scaffold, but cheap to fix now: register handlers that call `app.close()` before exiting.

### 12. `expo-web-browser` is declared but never imported

**Files:** `apps/mobile/package.json`

Not referenced anywhere in `apps/mobile/src`.

**Important:** despite the name, this is **not** a web-platform dependency — it is the native in-app browser module, so this branch was right to leave it alone. Flagged only so a future cleanup does not confuse the two, and so it can be dropped deliberately if nothing ends up using it.

Several other declared dependencies are likewise unimported (`expo-constants`, `expo-font`, `expo-image`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `react-native-safe-area-context`, and others). Most of these are required by `expo-router` or by config plugins and by Expo autolinking rather than by direct import — **do not bulk-remove them.** Any pruning here needs to be done one at a time with a native build to confirm.

### 13. Redundant `.expo` entries in the root gitignore

**Files:** `.gitignore`

`.expo/android` and `.expo/ios` are listed and then `.expo` is listed, which already covers both. Collapse to a single `.expo/`.

---

## Suggested order

1. Issue #1 (`platforms`) — this is the one real defect; the branch is incomplete without it.
2. Issues #2, #3 — trivial cleanup finishing the same job.
3. Issue #7 (CI with `npm ci`) — prevents recurrence of #5.
4. Issues #6, #8, #9, #10, #11, #13 — independent pre-existing fixes, each safe in isolation.
5. Issue #12 — needs a native build to validate; lowest priority, highest risk of breaking autolinking.
