# Tether — Phased MVP Delivery Plan

**Status:** Draft v0.1
**Companion to:** `PRD.md`, `ARCHITECTURE.md`

## Context

Tether is a privacy-first, self-hostable web app for seeing where the people you're
with are, on a shared live map. Location data is end-to-end encrypted; the server is a
zero-knowledge relay (see `PRD.md`, `ARCHITECTURE.md`).

**Current state (greenfield).** Two independent npm packages, no monorepo tooling:
- Root package — a default Fastify app with a single `GET /health` route (`src/server.ts`,
  `src/index.ts`) and one passing test (`tests/server.test.ts`).
- `frontend/` — an uncommitted create-next-app skeleton (Next 16 / React 19 / Tailwind v4);
  `frontend/app/page.tsx` just renders `hello`. **Note:** `frontend/AGENTS.md` warns Next 16
  has breaking API changes — consult `node_modules/next/dist/docs/` before writing app code.
- No shared core package, no Prisma/DB, no Docker, no WebSocket, no auth, no design system.

**Goal of this plan.** Break delivery into small, reviewable PRs, from a design-foundations
phase through a self-hostable feature-complete web MVP.

**Decisions taken for this plan:**
- **Scope / "finished" = self-host release (M3):** M1 vertical slice → M2 feature-complete web
  → M3 self-host packaging, including *essential* hardening (CSP/SRI/security headers).
  Reproducible builds + external crypto review are **out of MVP** (pre-public-release follow-up).
  Expo native (M4) is out of scope.
- **Design foundations = coded clickable prototype:** build the design system and screens in
  Next.js with mocked data; that shell becomes the real app (no throwaway rebuild). Phase is
  explicitly iterative — expect multiple passes before dev begins.
- **Map = Leaflet + OpenStreetMap hosted tiles** (deliberate deviation from Architecture §5.2's
  "self-host basemap"). Chosen for simplicity; trade-off is that viewport metadata reaches OSM's
  tile servers. To be disclosed honestly in-product and in docs. `ARCHITECTURE.md` should be
  updated to record this (§2, §5.2, §7.3, §8).

---

## Sequencing principle

Each numbered item below is intended as **one focused PR**. A few (crypto core, rekeying) are
larger and may split further during execution. Dev phases (1+) start only after Phase 0 sign-off.
The **shared `packages/core`** is used from day one (Architecture ADR-008) so the future Expo port
is not a rewrite — no crypto/protocol logic is written in `apps/web` directly.

---

## Phase 0 — Design Foundations (iterative, coded prototype) · milestone M0

Goal: settle the design system, the map-first visual language, and the end-to-end user flows in
real code with mocked data — and resolve the open product questions the prototype surfaces. No
backend, no crypto yet.

- **0.1 — Doc update + workspace scaffold.**
  - Update `ARCHITECTURE.md` to record the resolved decisions: map = **Leaflet + OSM**
    (rewrite §5.2, update §2 map-library row, §7.3 tile-provider threat row, §8 deployment stack —
    no `tiles` container); Next.js role = **client shell + router only, browser talks to Fastify
    directly** (adopt §2's PROPOSED); styling = **Tailwind v4 + a small `packages/ui` layer**.
  - Convert to a workspace (pnpm workspaces or Turborepo): `apps/web` (move `frontend/`, commit it),
    `apps/api` (move root Fastify `src/` + `tests/`), `packages/core` (empty skeleton),
    `packages/ui` (design-system home). Shared root `tsconfig`, lint config, scripts.
- **0.2 — Design system foundation.** Design tokens (color, type, spacing, radius, motion),
  light/dark mode, and the two hard constraints from PRD §11: a **sharing-state** visual language
  (exact / approximate / hidden, legible in sunlight) and a **staleness** visual encoding (live vs
  stale dots). Core primitives in `packages/ui`: Button, Sheet/Drawer, Avatar/marker, Badge,
  Field. A `/kitchen-sink` route (or Storybook) to review them.
- **0.3 — App shell + map canvas.** Full-bleed Leaflet map as the product surface, chrome over the
  canvas. Mocked member markers rendering the sharing-state + staleness language from 0.2. Freshness
  handled as a rendering concern, not per-frame React state (Architecture §6.4).
- **0.4 — Screen flows (mocked).** Clickable, navigable prototypes of every MVP flow: create room
  (name + emoji), guest join/landing, in-room map + **member list presentation** (bottom sheet vs
  avatar tray — decide here), share sheet (QR + link), ghost/precision controls, history view.
  This is where flow/layout decisions get made and iterated (PRD §10 [OPEN] items).
- **0.5 — Design review + resolve blocking product questions.** Fold prototype learnings back into
  `PRD.md`: guest capabilities (ghost/precision/history/room-creation — PRD Q1), **member
  leave/removal** (PRD §10.8 — this unblocks the rekey design in Architecture §3.4), ghost
  global-vs-per-room (PRD Q2), member-card contents, invite expiry/use defaults, blur radii.

> Expect 0.2–0.4 to iterate across multiple PRs/rounds before Phase 0 is signed off.

---

## Phase 1 — Backend foundations & vertical slice · milestone M1

Goal: auth + E2EE + live presence in one real room, replacing mocked map data.

- **1.1 — DB foundation.** Add Prisma + a `db` service in `docker-compose.yml`. Initial schema for
  `users` and `sessions` (Architecture §5.3), migration tooling, seed. Wire `apps/api` to Postgres.
- **1.2 — Shared crypto core.** `packages/core`: X25519 identity keys, XChaCha20-Poly1305,
  Argon2id + HKDF (`master`/`KEK`/`verifier` split, Architecture §3.1/§3.6), sealed-box room-key
  distribution, position envelope types (§3.7), deterministic blur function (§3.7 PROPOSED), domain
  types, distance/bearing math. Pure TS with injected adapters; **thorough unit tests** (crypto
  errors are the top-severity risk, Architecture §10). No DOM/React/storage/geolocation here.
- **1.3 — Auth.** Signup (client key-gen + vault wrap + verifier), login (pull vault, derive KEK,
  unwrap), session cookie. Surface the D11 warning at signup (admin reset destroys history). Replace
  the prototype's mock auth.
- **1.4 — Rooms.** Create room (name + emoji encrypted under the room key), `rooms` + `memberships`
  schema, per-member sealed room-key storage and hand-out on join (§3.3). Owner-only for now.
- **1.5 — Realtime vertical slice.** WS relay with the `Broadcaster` interface (in-memory,
  Architecture §4.4), membership-validated subscribe, `POSITION`/`PRESENCE`/`STATE` messages
  (§4.3), encrypted position round-trip. Position pipeline in the web client (§6.2:
  geolocation → throttle → encrypt → send). Live data replaces mocked markers for the owner's room.

---

## Phase 2 — Feature complete · milestone M2

- **2.1 — Invites.** Expiring, revocable links + QR; token stored as hash with
  `expires_at`/`uses`/`max_uses`/`revoked_at` (§3.5); URL fragment carries a hint, not the key.
- **2.2 — Guests.** Single-use invite consumption, ephemeral browser-only keys (never sent to
  server, §3.2), guest join flow from 0.4. Apply the guest-capability decision from 0.5.
- **2.3 — Multiple rooms.** Room switching, roster, membership lifecycle across rooms.
- **2.4 — Sharing controls.** Ghost mode (releases the geolocation watch at OS level, sends plaintext
  `STATE`; visible to room per Principle 2) and precision blur (deterministic, client-side *before*
  encryption).
- **2.5 — Member management + rekeying.** Leave/removal per the 0.5 decision; epoch-based rekey with
  the `REKEY` message + sealed keys (§3.4); server rejects stale-epoch writes; clients keep old
  epoch keys to read retained history.
- **2.6 — History.** Client buffering → batched encrypted `segments` upload (§5.1), scheduled
  server-side retention delete + client-side refusal to render past window (§5.5), member self-delete.

---

## Phase 3 — Self-host release · milestone M3

- **3.1 — Compose stack.** Full `docker-compose.yml`: `web`, `api`, `db` (named volume), `proxy`
  (TLS). No tile container (Leaflet + OSM). Single-file, zero external accounts/API keys/SMTP.
- **3.2 — Admin CLI.** Password reset (prints the destructive-consequence warning + explicit
  confirm, D11), user/room list, room delete, invite revoke, retention run, backup (§8).
- **3.3 — Essential hardening.** Strict CSP, subresource integrity, security headers. (Reproducible
  builds + external crypto review are flagged as required-before-public-release, out of this MVP.)
- **3.4 — Self-host docs.** README, one-command setup, upgrade path, and honest disclosure of the
  OSM tile viewport leak and the web background-location limitation (PRD §9.1).

---

## Verification

- **Per package:** `apps/api` keeps `node:test` (extend from `tests/server.test.ts`); add a test
  runner (vitest) to `packages/core` and `apps/web`. `pnpm -r test` + `tsc --noEmit` green per PR.
- **Phase 0:** manual design review of `/kitchen-sink` and each mocked flow in light/dark; sunlight
  legibility check on sharing-state + staleness; sign-off before dev.
- **Phase 1:** unit-test crypto round-trips in `packages/core`; two browser sessions on one account
  see each other's encrypted positions move live on the map; DB stores only ciphertext (inspect
  `segments`/relay — no plaintext coordinates anywhere).
- **Phase 2:** guest joins via QR (single-use enforced); ghost mode stops broadcast and is visible;
  blurred precision never reveals exact point; removed member is rekeyed out; history retained then
  deleted on schedule.
- **Phase 3:** `docker compose up` on a clean host yields a working instance with a domain + TLS and
  no outbound service dependencies; admin CLI password reset shows the warning and issues a fresh key.
