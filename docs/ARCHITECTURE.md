# Architecture

**Status:** Draft v0.2
**Companion to:** `PRD.md`

> **Tagging:** **[DECIDED]** settled in discussion · **[OPEN]** genuinely undecided · **[PROPOSED]** my suggestion, awaiting your call.

---

## 1. Summary

A **zero-knowledge relay**. Clients encrypt location updates with a shared room key and push them over WebSocket. The server authenticates, authorises, routes, and stores opaque ciphertext. It has no ability to decrypt anything and no geospatial logic.

The consequence that matters: **the server is a dumb pipe with an access-control list.** Any feature requiring the server to understand a coordinate is architecturally impossible, not merely unimplemented. That constraint is what keeps the privacy promise honest as the product grows.

```
┌──────────────────┐          ┌──────────────────┐
│  Next.js (web)   │          │  Expo (later)    │
└────────┬─────────┘          └────────┬─────────┘
         │                             │
         └─────────────┬───────────────┘
                       │  shared TS core (crypto, protocol, domain)
                       │
                  HTTPS + WSS
                       │
              ┌────────▼─────────┐
              │  Fastify API     │  auth · rooms · invites
              │  ── no plaintext │  WS relay · batch writer
              └────────┬─────────┘
                       │
                 ┌─────▼─────┐
                 │ Postgres  │   opaque encrypted blobs
                 │ (Prisma)  │
                 └───────────┘
                docker compose stack
```

---

## 2. Stack **[DECIDED]**

| Layer | Choice |
|---|---|
| Web client | **Next.js** — client shell + router only (see below) |
| API | **Node + TypeScript + Fastify** |
| Realtime | **WebSocket** |
| Database | **PostgreSQL only** |
| ORM | **Prisma** |
| Fanout | **In-memory, behind a swappable interface** |
| Map rendering | **Leaflet + OpenStreetMap hosted tiles** |
| Styling | **Tailwind v4 + a small `packages/ui` design-system layer** |
| Deployment | **Docker Compose** |
| Native (later) | **Expo** |

### Not yet decided **[OPEN]**

- Client state management.
- Local caching mechanism.
- Session/auth library vs. hand-rolled.
- Migration and deployment tooling beyond Prisma's own.

### Next.js role **[DECIDED]**

Next is a **client shell + router only**: the browser talks to Fastify directly for both REST and WS, and Next's server runtime does no proxying or session-holding. No BFF, one auth path. There is effectively no SSR of authenticated data — most of the app is behind auth and driven by a live map, so server rendering buys nothing; Next's job is bundling, routing, and static shell delivery.

---

## 3. Cryptographic design **[DECIDED]**

Unchanged from v0.1 — this section was not flagged as wrong.

### 3.1 Identity keys
On signup the client generates an **X25519 keypair**. The public key goes to the server in plaintext. The private key is stored server-side **encrypted**:

```
KEK   = Argon2id(password, salt)
vault = XChaCha20-Poly1305(KEK, identity_private_key)
```

The server stores `vault` and `salt`, never the password or the KEK. A second device signs in, pulls the vault, derives the KEK locally, unwraps the key.

**This is why admin password reset destroys history (PRD D11).** Reset the password and the KEK is gone; the vault is unrecoverable. The CLI must issue a fresh keypair and warn explicitly.

### 3.2 Guest keys **[DECIDED, new]**
Guests generate an ephemeral X25519 keypair in the browser. It is **never** sent to the server in any form, encrypted or otherwise, and there is no vault. Clearing browser storage destroys it permanently — which is exactly the intended behaviour per PRD D3.

### 3.3 Room keys
Each room has a symmetric **room key** (XChaCha20-Poly1305), generated client-side by the creator, never sent to the server in plaintext.

Distribution uses **sealed boxes**: the room key is encrypted to each member's X25519 public key. The server stores an opaque wrapped key per member per room and hands it out on join. It cannot unwrap any of them. Guests receive a sealed copy the same way.

### 3.4 Rekeying **[BLOCKED on a product decision]**
Rekeying is required when someone loses access — leaving or removal. **PRD §10.8 hasn't decided whether either exists**, so this can't be finalised.

If they do exist: rotate on membership loss. Messages carry an **epoch** number; clients keep old epoch keys to read retained history, and the server rejects writes at a stale epoch.

**Honest limitation to document publicly:** rekeying blocks a departed member from future traffic. It cannot claw back history they already downloaded. True of every E2EE system.

### 3.5 Invite tokens
```
https://instance.tld/j/<invite_id>#<fragment>
```
The URL **fragment** is never sent to the server, but it does land in clipboards and screenshots — so it carries a hint, not the room key itself. The actual key is only released after the server validates the invite and the client fetches its sealed copy. A leaked link alone is therefore insufficient.

Invites are stored as hashes with `expires_at`, `uses`, `max_uses`, `revoked_at`. Guest invites are marked consumed on first use (PRD D3). QR encodes the identical URL.

### 3.6 Password separation
The password does double duty, so the two uses are cryptographically separated:

```
master   = Argon2id(password, salt)          // client-side, never transmitted
KEK      = HKDF(master, "vault")             // unwraps the identity key
verifier = HKDF(master, "auth")              // sent to server
```
The server stores a hash of `verifier`. A full database compromise plus offline cracking yields the verifier, not the KEK.

### 3.7 Payload
```
{ room_id, epoch, sender_id, seq, nonce, ciphertext }
```
Plaintext inside: coordinates, accuracy, heading, speed, capture time.

Precision blurring happens **client-side before encryption** (PRD D7). The server has no knowledge of precision at all.
**[PROPOSED]** Make the blur deterministic per (user, room, time-bucket). Naively re-randomised blur can be averaged across samples by other members to recover the true position.

---

## 4. Realtime **[DECIDED]**

### 4.1 Model
Server-authoritative. **No sync engine, no CRDTs, no local database as source of truth.** Client-side storage is a disposable cache — if it's lost, the client refetches. See ADR-001.

### 4.2 Connection
`WSS` upgrade authenticated by session. Client subscribes to its rooms; server validates membership before joining any channel.

### 4.3 Messages **[PROPOSED shape]**

| Direction | Type | Purpose |
|---|---|---|
| C→S | `POSITION` | encrypted envelope |
| C→S | `STATE` | sharing mode change |
| S→C | `POSITION` | relayed envelope |
| S→C | `PRESENCE` | who's connected |
| S→C | `MEMBERSHIP` | roster change |
| S→C | `REKEY` | new epoch + sealed key |

`STATE` is deliberately **plaintext**. Whether you're hidden isn't secret from the server — Principle 2 makes it visible to the room anyway — and keeping it plaintext lets the server stop relaying your positions entirely rather than forwarding ciphertext nobody should receive. Defence in depth over purity.

### 4.4 Fanout **[DECIDED]**
In-memory, behind a `Broadcaster` interface exposing `publish` / `subscribe`.

A single Node process handles thousands of concurrent sockets, and rooms hold 5–20 people. No realistic self-hosted instance outgrows one process. The interface means swapping in Redis later is one adapter, not a refactor.

Rejected: Redis from the start (a container every self-hoster must run and understand, against the one-compose-file goal); Postgres `LISTEN/NOTIFY` (turns every position update into database traffic for data you're only relaying, caps payloads at 8KB, and breaks behind a transaction-mode pooler).

**Consequence to accept:** you cannot run API replicas behind a load balancer, and a restart drops every connection. Clients reconnect, so this is a blip rather than a fault.

### 4.5 Delivery semantics **[PROPOSED]**
Position updates are **lossy by design**. Latest-wins per sender, no retry, no ordering guarantee beyond a monotonic `seq` used to discard stale packets. A dropped position is superseded within seconds; reliable delivery here would be wasted complexity.

---

## 5. Data

### 5.1 Storage split **[DECIDED]**

Two separate paths:

- **Live path** — WebSocket relay. Stores **nothing**. Pure fanout.
- **History path** — client buffers positions locally, encrypts a run of them as a single blob, uploads periodically.

**Why batched segments.** For a 10-person room at one point per 5s over 4 active hours/day, row-per-position produces roughly 29k rows/day/room and ~865k over a 30-day window. Batched at ~5 minutes, the same room produces ~500 rows/day. Delta-encoded coordinates compress well inside the blob, so it's 50–100x less storage and far less index churn. Retention becomes a cheap delete by timestamp, and "delete my history" is a small operation.

**Costs accepted:** history lags by up to the batch window; deletion granularity is the segment, not the point; a client that dies mid-buffer loses that window unless it persists locally first (it should).

**[OPEN]** Batch window length. 5 minutes is a placeholder, not a decision.
**[OPEN]** Whether guests write history at all.

### 5.2 The tile problem **[DECIDED — deliberate deviation]**

Fetching map tiles from a hosted provider (Mapbox, Google, and similar) transmits the user's viewport — effectively their location — to a third party on every pan. You'd have built end-to-end encryption and then leaked the same information through the basemap.

Options considered: self-host a basemap (adds a container and a sizeable asset, keeps zero outbound dependencies); use a hosted provider and disclose the leak honestly; or proxy tiles through your own API (hides the user's IP from the provider, but the provider still sees viewports and your server sees them too).

**Chosen: Leaflet + OpenStreetMap's hosted tile servers**, not a self-hosted basemap. Rationale: self-hosting a basemap is a meaningful chunk of infra (tile generation/storage, a container every self-hoster must run) for a v1 whose priority is shipping the core E2EE product. OSM's hosted tiles are free, require no API key, and keep the compose file simple.

**Trade-off, disclosed honestly:** panning the map sends viewport coordinates to OSM's tile servers — a real, if coarse and non-attributable-to-identity, location leak to a third party. This is the opposite of the "self-host basemap" position originally proposed here. It is documented in-product (see PRD §9.2, §11) and in the self-host docs (Phase 3.4), not hidden. Revisit post-MVP if a self-hosted basemap becomes worth the added ops burden.

### 5.3 Entities **[PROPOSED skeleton]**

Sketch only — several fields depend on unresolved product questions.

```
users        id, email, password_verifier_hash, identity_pubkey,
             key_vault, kdf_salt, display_name, created_at

guests       id, room_id, display_name, identity_pubkey,
             created_at, last_seen_at

rooms        id, name, emoji, owner_id, current_epoch,
             retention_days, created_at

memberships  subject_id, subject_type, room_id, role,
             sealed_room_key, epoch, sharing_state, joined_at

invites      id, room_id, token_hash, created_by,
             expires_at, max_uses, uses, revoked_at, consumed_at

segments     id, room_id, subject_id, epoch,
             started_at, ended_at, nonce, ciphertext

sessions     id, subject_id, subject_type, expires_at
```

Guests and users are separate tables with a polymorphic `subject` reference, because they have genuinely different lifecycles — guests have no credentials, no vault, and cascade-delete with the room.

**[OPEN]** Whether that polymorphism is worth it versus a single `identities` table with a nullable credential set.

### 5.4 No PostGIS **[DECIDED]**
Worth stating because someone will propose it. A spatial database is useless here — the server never sees a coordinate, and `ciphertext` is an opaque blob. There is nothing to index spatially and no geometry to query. Adding PostGIS would signal an intent the architecture forbids.

All distance calculation, proximity sorting and bounds-fitting happens client-side after decryption.

### 5.5 Retention **[DECIDED]**
Scheduled delete of segments older than the retention window, plus client-side policy refusing to render or cache anything past it. Two independent enforcement paths.

Postgres-only means partitioning is available if volume demands it later, but batched segments should make plain deletes sufficient for a long time.

---

## 6. Client

### 6.1 Shared core **[DECIDED]**
A platform-agnostic TypeScript package consumed by Next.js today and Expo later: crypto primitives, envelope handling, key vault, WS protocol client and reconnection, domain types, distance/bearing math, blur function.

Excluded: anything touching the DOM, React, storage APIs, or geolocation. Those are injected as adapters — that's what makes the Expo port tractable rather than a rewrite.

### 6.2 Position pipeline **[DECIDED]**
```
Geolocation → throttle → blur (if approx) → encrypt → WS send
                                                    ↘ local buffer → batch upload
```
Encryption happens before anything leaves the module. There should be no code path where a plaintext coordinate reaches the network layer — enforce this by typing the WS client to accept only encrypted envelopes.

### 6.3 Polling **[OPEN]**
Undecided. Fixed-interval GPS polling is the fastest way to make this feel like a battery parasite, so some adaptation to movement is likely needed — but the strategy needs real device measurement before committing. Ghost mode should release the geolocation watch entirely rather than discarding results, so the guarantee holds at the OS level.

### 6.4 Rendering **[DECIDED — map library]**
Leaflet + OSM hosted tiles (§5.2). One durable constraint regardless of library: data freshness must be visually encoded, and it should be a rendering concern rather than React state so it doesn't trigger re-renders every frame.

---

## 7. Security

### 7.1 What the operator cannot learn **[DECIDED]**
Anyone's location, at any precision, ever. Room names and emoji are also encrypted client-side under the room key.

### 7.2 What the operator *can* learn **[DECIDED — disclosed, not hidden]**

Stated plainly, because a privacy product that conceals its own leaks is worse than one making no promises:

- Which accounts exist, and their email addresses
- Which identities share which rooms — **the full social graph**
- When each identity is active, and for how long
- Message frequency and size, per identity per room
- IP addresses at connection time
- Display names

Accepted cost of persistent accounts (PRD D2). Guests leak less: no email, no persistence, no cross-room linkage.

### 7.3 Threat model

| Threat | Handling |
|---|---|
| Malicious/compromised server | Cannot decrypt. Can deny service and lie about membership. Cannot be defended against serving malicious client JS — see §7.4 |
| Database exfiltration | Yields ciphertext, verifier hashes, metadata. No locations |
| Leaked invite link | Insufficient alone — needs an unexpired, unconsumed invite. Owner can revoke |
| Departed member | Rekey blocks future access. Already-downloaded history is unrecoverable |
| Network observer | TLS. Traffic analysis reveals activity patterns; not defended in v1 |
| Malicious member | In-scope by design — everyone chose to be visible to the room |
| Tile provider tracking | **Accepted, disclosed.** Leaflet + OSM hosted tiles leak viewport (not identity) to OSM on pan. See §5.2 |

### 7.4 The web delivery problem **[DECIDED — disclosed]**
E2EE in a browser has a structural weakness: the server ships the code that does the encryption. A malicious operator could serve a build that exfiltrates keys. This is not solvable within a web app, and we shouldn't pretend otherwise.

Mitigations: strict CSP, subresource integrity, reproducible builds with published hashes so a third party can verify the served bundle matches source. **The Expo app is the real answer** — store binaries can't be silently swapped per user. Another argument for prioritising native.

---

## 8. Deployment **[DECIDED]**

```yaml
services:
  web:    # Next.js
  api:    # Fastify — REST + WS + batch writer
  db:     # Postgres, named volume
  proxy:  # TLS termination
  # No tiles container — Leaflet + OSM hosted tiles, see §5.2
```

**Operator requirements:** a domain, Docker, modest RAM. No external accounts, no API keys, no SMTP. Zero outbound dependencies is the design target — it's what makes self-hosting real.

**Admin CLI** **[PROPOSED]**: password reset, user list, room list/delete, invite revoke, retention run, backup. Password reset must print the destructive-consequence warning from PRD D11 and require explicit confirmation.

---

## 9. ADRs

**ADR-001 — Server-authoritative, no sync engine.**
The initial brief said "local-first," which was ambiguous. Resolved: it meant privacy-first, not the technical local-first architecture. Offline capability is near-useless for a live map, so a sync engine's core benefit doesn't apply here.
There's also a hard technical conflict: Electric, Zero and PowerSync do partial replication by filtering and indexing rows server-side. Every row here is ciphertext, so they can't — you'd lose most of their value and keep all their complexity. **E2EE and off-the-shelf sync engines fight each other.**
Residual risk: offline support may arrive later as ad-hoc queues and reconnect logic. Watch for accidentally reinventing a worse sync engine.

**ADR-002 — WebSocket relay, not P2P/WebRTC.**
WebRTC removes the server from the data path, but mesh scales O(n²), NAT traversal needs TURN (which sees the traffic anyway), and mobile-to-mobile reliability is poor. A relay that can't read anything gets nearly the same privacy with far better reliability.

**ADR-003 — Node/TypeScript + Fastify.**
Lets the API share the core package with the clients — one crypto implementation, one protocol definition, no drift between two languages implementing the same envelope. Per-message work is O(1), so raw throughput isn't the binding constraint.

**ADR-004 — Postgres only, via Prisma.**
Multi-database support was briefly considered and rejected: dialect differences across migrations, JSON handling and scheduled deletes would create a real test matrix and ongoing maintenance burden for little gain. Self-hosters get Postgres in the compose file and don't need a choice.

**ADR-005 — In-memory fanout behind an interface.**
See §4.4.

**ADR-006 — Batched history segments, split from the live path.**
See §5.1.

**ADR-007 — No federation.**
Cross-instance rooms would need identity federation, cross-instance key distribution, and a rekey protocol spanning servers — more complex than the rest of the product combined.

**ADR-008 — Web first, Expo second, shared core from day one.**
The core package costs some discipline now and saves a rewrite later. Background location and verifiable binaries both depend on native, so the port is a certainty.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Web background limitation makes the app feel broken | **High** | Honest onboarding, staleness UI, prioritise Expo |
| Battery drain drives uninstalls | High | Polling strategy undecided — measure on real devices before M2 |
| Crypto implementation error | **High** | Standard primitives only, no custom constructions; external review before public release |
| Tile privacy leak undermines the whole premise | **High** | Unresolved — §5.2 needs a decision |
| Guest key loss on tab close generates support load | Medium | Accepted per PRD D3; make the message clear |
| Owner deletion destroying rooms surprises households | Medium | Accepted per PRD D10; warn explicitly at deletion |
| Rekey design blocked on undecided leave/removal flows | Medium | Resolve PRD §10.8 before M2 |
| Next.js + separate API leaves an ambiguous server layer | Low | Decide §2 before building auth |

---

## 11. Build sequence **[PROPOSED]**

1. **Foundations** — monorepo, shared core skeleton, compose stack, Prisma schema.
2. **Auth** — signup, login, key generation, vault wrap/unwrap, sessions.
3. **Rooms** — create (name + emoji), membership, sealed key distribution.
4. **Invites** — expiring links, single-use guest consumption, QR.
5. **Realtime** — WS relay, Broadcaster interface, presence, encrypted round-trip.
6. **Map** — rendering, tiles (pending §5.2), member display, staleness.
7. **Controls** — ghost mode, precision blur.
8. **History** — client buffering, batch upload, retention job, self-delete.
9. **Ops** — admin CLI, backups, upgrades, self-host docs.
10. **Hardening** — CSP, SRI, reproducible builds, crypto review.
11. **Expo** — native clients, background location.
