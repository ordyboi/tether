# Product Brief / PRD

**Status:** Draft v0.2
**Companion to:** `ARCHITECTURE.md`

> **How to read this.** Every item is tagged:
> **[DECIDED]** — settled in discussion, with reasoning recorded.
> **[OPEN]** — genuinely undecided. Not filled in with a default.
> **[PROPOSED]** — a suggestion awaiting your call, clearly marked as mine, not yours.

---

## 1. Summary

A privacy-first, self-hostable web app for seeing where the people you're with are, on a shared map, in real time.

The core primitive is a **room**. You create one, share a QR code or link, and everyone who joins appears on a live map. Location data is end-to-end encrypted — the server relays it but can never read it. Anyone can run their own instance with Docker Compose.

**Terminology correction from v0.1:** this is **not** a local-first app in the technical sense. There is no local database as source of truth, no CRDTs, no sync engine. It is a privacy-first app with a server-authoritative model. See Architecture ADR-001.

---

## 2. Problem

1. **Existing location sharing is surveillance-shaped.** Google, Apple, Life360 and Snap collect precise, persistent location for commercial purposes. The products work; the price is a permanent record of your movements held by someone else.
2. **It's all-or-nothing and permanent.** Sharing is person-to-person and indefinite. There's no good primitive for "the eight of us, for this festival, today."
3. **It's locked to a platform.** Cross-platform group sharing between iOS and Android users is consistently awkward.

There is no serious option for someone who wants group location sharing but doesn't want to trust a company with it.

---

## 3. Goals **[DECIDED]**

- **G1.** A group can see each other on a map within about a minute of one person deciding to start.
- **G2.** Make it technically impossible for the server operator to read anyone's location.
- **G3.** Make self-hosting genuinely achievable — one compose file, no external service dependencies.
- **G4.** Give users real, legible control over what they broadcast, at any moment.
- **G5.** Work across iOS, Android and desktop from day one.

## 4. Non-goals **[DECIDED]**

- Not a fitness or route-tracking app.
- Not a messaging app. No chat in v1.
- Not geofencing, arrival alerts, or driving scores.
- Not a covert tracking tool. Everyone in a room is visible to everyone else; no observer-only mode.
- Not federated. Rooms live on one instance.
- Not background tracking on web. See §9.

---

## 5. Principles **[DECIDED]**

Ranked, so they resolve arguments later.

1. **The server is not trusted.** Every decision assumes the operator may be hostile or compromised. If a feature needs server-readable location, it doesn't ship.
2. **Symmetry of visibility.** If you can see someone, they can see you're in the room. No asymmetric surveillance, including between owner and member.
3. **Legible over clever.** A user should be able to state in one sentence what they're currently sharing.
4. **Ephemeral by default, persistent by choice.**
5. **Self-hosting is a first-class path.** Hosted and self-hosted are the same build.

---

## 6. Users

General-purpose. The room is the primitive; use cases differ only in room lifetime. **[DECIDED]**

| Persona | Room lifetime | What matters most |
|---|---|---|
| Event group — festival, conference, trip | Hours to days | Zero-friction join, works with strangers and non-users |
| Household — family, roommates, partners | Indefinite | Persistent membership, low battery drain, history |
| Field team — crew, marshals, volunteers | A shift | Reliability, quick roster scanning, precision control |
| Self-hoster | N/A | One compose file, clear upgrades, no vendor dependencies |

---

## 7. Core concepts

- **Account** **[DECIDED]** — persistent identity, stable across rooms. Email + password. Can create rooms.
- **Guest** **[DECIDED]** — temporary, room-scoped identity created by consuming an invite. No account, no persistence, no recovery. See D3.
- **Room** **[DECIDED]** — name + emoji, an owner, a member list, a shared encryption key.
- **Membership** — links an identity to a room, with a role and sharing state.
- **Invite** **[DECIDED]** — time-limited, revocable, rendered as link and QR. Single-use per guest.
- **Presence** — current live encrypted position. Never stored.
- **Trail** **[DECIDED]** — retained encrypted position history. 30 days, then deleted.

---

## 8. Decisions

### D1 — End-to-end encryption; server relays ciphertext only **[DECIDED]**
The server never sees a plaintext coordinate. This is the product's reason to exist.
**Cost:** no server-side geo features, ever. No server-computed proximity, alerts, or moderation of location content. Accepted.

### D2 — Persistent accounts **[DECIDED]**
Stable identity across rooms, so people don't reintroduce themselves.
**Cost:** the server learns the social graph — which accounts share which rooms, and when they're active. Chosen knowingly. See Architecture §7.2.

### D3 — Guests can join without an account **[DECIDED]**
An invite link can be consumed by someone with no account. They get a temporary, room-scoped identity.

- The link is **single-use** — once consumed, that link cannot be used again.
- Guest identity is **not saved to an account**.
- If the guest closes the tab or clears their browser, **they're gone** and need a fresh invite from the owner.

**Reasoning:** removes the signup wall from the event use case, which is where friction hurts most. Also strong for privacy — guest keys are disposable and never leave the device.
**Risk to log:** an accidental tab close at a festival means tracking down the owner again. This is a real UX cost of the decision, not a bug.
**[OPEN]** Can guests use ghost mode and precision control? Can they see history? Can they create rooms? (Assumed no on room creation, but unconfirmed.)

### D4 — Join via expiring links and QR codes **[DECIDED]**
Mobile-first: QR for in-person handoff, links for remote. Both expire, both revocable by the owner.
**Bonus:** expiry gives natural key rotation, and bounds the damage of a link pasted into a group chat that outlives the event.
**[OPEN]** Default expiry window. Default use limits for account holders (guests are single-use by D3).

### D5 — Room creation is name + emoji, then launch **[DECIDED]**
No settings gate at creation. Owner customises afterwards via room settings, reached from the room icon on the map screen.
**Reasoning:** creation should take seconds. Configuration is an owner concern, not a blocker.
**[OPEN]** What's actually in room settings beyond retention, invites and member management.

### D6 — Sharing is initiated from inside the room **[DECIDED]**
A share button somewhere in the room opens the QR and link.
**[OPEN]** Placement. Explicitly undecided.

### D7 — Two sharing controls in v1 **[DECIDED]**
- **Ghost mode** — stay in the room, see everyone, broadcast nothing. Per Principle 2, going ghost is always visible to the room; it is never silent.
- **Precision** — exact, or blurred to a radius. Blurring happens **client-side before encryption**, so the server and other members only ever receive the coarse point.

**Deferred to v2:** time-boxed auto-stop, per-room overrides.
**[OPEN]** The specific blur radii. Whether ghost mode is global or per-room — currently unspecified, and likely the biggest v2 regret if we get it wrong.

### D8 — 30-day history **[DECIDED]**
Trails retained 30 days, then deleted.
**Tension, recorded honestly:** this is the softest point in the privacy model. Encrypted blobs sit on a server for a month. Unreadable without the room key, but their existence, size and timing are visible to the operator.
**Mitigations:** retention enforced server-side and client-side; any member can delete their own trail, genuinely rather than as a tombstone.
**[OPEN]** Whether owners can set retention lower than 30 days. How history is presented (timeline scrubber, trail overlay, something else) — deferred to design.

### D9 — Rooms live until the owner deletes them **[DECIDED]**
No automatic expiry, no inactivity archival.

### D10 — Deleting the owner deletes the room **[DECIDED]**
No ownership transfer. If the owner deletes their account or leaves, the room goes with them.
**Risk to log:** a household room dies if the owner deletes their account. There is no succession path. Acceptable for v1, but expect this to generate support requests.

### D11 — Email + password, admin CLI recovery **[DECIDED]**
Password reset is performed by an instance admin via CLI. No SMTP required to run an instance, which meaningfully lowers the self-hosting bar.
**Consequence that must be surfaced in the UI:** the password also unlocks the user's key vault. An admin reset restores account access but **permanently destroys access to previously encrypted history**. The user keeps their identity and rooms but needs a fresh key. State this plainly at signup.
**[OPEN]** Whether v2 adds self-service recovery phrases.

### D12 — Web first, Expo native later **[DECIDED]**
PWA now; React Native via Expo planned. Shared TypeScript core for crypto and protocol so the port isn't a rewrite.

---

## 9. Known constraints

### 9.1 Background location doesn't work on the web **[DECIDED — accepted]**
Browsers suspend geolocation when backgrounded; iOS Safari stops almost immediately on screen lock. **On web, the app only reports position while open and in the foreground.**

We design around it honestly rather than fighting it:
- Stale positions must be visually distinct from live ones. A user should never mistake a ten-minute-old dot for a current one.
- Onboarding states plainly that sharing happens while the app is open.
- **Native (Expo) is the fix.** Background location is the strongest argument for the native app and should be its headline feature.

**[OPEN]** Exact staleness thresholds and how staleness is rendered. Whether to offer a Screen Wake Lock.

### 9.2 Other constraints
- **No server-side geo logic, ever.** Architecturally impossible, not merely unimplemented.
- **Battery.** Continuous GPS plus map rendering is expensive. **[OPEN]** — polling strategy is undecided and needs real device measurement.
- **Map tiles leak location if fetched from a third party.** Panning the map sends your viewport to the tile provider. This would defeat the product through the back door. **[OPEN]** — see Architecture §5.2 for the proposed fix.
- **Metadata is visible to the operator.** Documented, not hidden. See Architecture §7.2.

---

## 10. Flows

Rewritten to match D3–D10. Steps not specified below are genuinely undecided.

### 10.1 Guest joins via invite **[DECIDED shape]**
1. Guest opens link or scans QR.
2. Landing screen shows room name, emoji, and member count.
3. Guest provides a display name.
4. Keys generated locally. The invite is consumed and cannot be reused.
5. Location permission requested.
6. Guest enters the room and appears on the map.

**Branches:** invite already used or expired → clear message, direct them to ask the owner for a new one. Location denied → **[OPEN]** whether the room is still viewable read-only.
**[OPEN]** Whether a guest picks an emoji/avatar. Whether the landing screen previews anything about the room.

### 10.2 Account holder joins **[OPEN]**
Presumably: open link → sign in or sign up → join. Whether account holders also consume the link single-use, or whether their invites allow multiple uses, is undecided (see D4).

### 10.3 Creating a room **[DECIDED]**
1. Create room.
2. Enter a name.
3. Choose an emoji.
4. Launch.
5. Owner can open room settings from the room icon on the map screen.

### 10.4 Inviting **[PARTIAL]**
Owner taps a share button inside the room; QR and copyable link are presented. **[OPEN]** placement, and whether non-owners can invite.

### 10.5 In-room **[MOSTLY OPEN]**
**[DECIDED]** Full map. Members visible. Selecting a member moves the view to them.
**[OPEN]** How the member list is presented — bottom sheet, avatar tray, drawer. To be explored in design.
**[OPEN]** What's on a member card. Where the sharing control lives. What "actions" the room screen offers.

### 10.6 Ghost mode and precision **[PARTIAL]**
**[DECIDED]** Both exist. Ghost stops broadcasting client-side and is visible to the room. Precision blurs before encryption.
**[OPEN]** Entry point, control design, radius options, whether these are global or per-room.

### 10.7 History **[PARTIAL]**
**[DECIDED]** 30-day retention. Self-delete available.
**[OPEN]** Entire presentation.

### 10.8 Leaving, removal, deletion **[PARTIAL]**
**[DECIDED]** Owner deleting their account deletes the room (D10).
**[OPEN]** Whether members can leave voluntarily. Whether owners can remove members. What a removed person sees. Whether room deletion requires confirmation.

> Note: member removal is worth deciding soon, because it drives the rekeying requirement in Architecture §4.3.

---

## 11. Design system **[OPEN]**

Deferred to design exploration. The only constraints established so far:

- The map is the product; UI is chrome over a canvas.
- Sharing state (exact / approximate / hidden) must be distinguishable at a glance, outdoors, in sunlight.
- Data freshness must be visually encoded — staleness is a first-class dimension, not a caption.
- Rooms have an emoji as part of their identity, so the visual language must accommodate user-chosen emoji.

Everything else — colour, type, layout, motion, dark mode — is undecided.

---

## 12. Success metrics **[PROPOSED]**

Not yet agreed. Offered as a starting point:

- Time from invite open to visible map.
- Invite open → room entry conversion.
- Location permission grant rate.
- Rooms reaching 3+ simultaneous members — the app is worthless at n=1, so this is the real activation metric.
- Guest → account conversion, if that path ever exists.

---

## 13. Open questions, consolidated

1. Can guests use ghost mode, precision, and history? Can they create rooms?
2. Is ghost mode global or per-room? Most likely v2 regret.
3. Can members leave? Can owners remove members? (Blocks the rekey design.)
4. Do account holders' invites work differently from guest invites?
5. Default invite expiry and use limits.
6. Member list presentation, share button placement, history presentation — all design.
7. Avatars: do they exist? If so, stored encrypted or plaintext?
8. Is there any chat or ping primitive? "Where are you?" is the obvious next need after seeing a map, and its absence may be the top complaint.
9. Blur radius options.
10. What's in room settings.

---

## 14. Milestones **[PROPOSED]**

- **M0 — Prototype.** Clickable, mocked data. Resolves the open design questions above.
- **M1 — Vertical slice.** Auth, E2EE, live presence in one room.
- **M2 — Feature complete.** Multiple rooms, guests, invites, ghost mode, precision, history, admin CLI.
- **M3 — Self-host release.** Compose file, docs, upgrade path.
- **M4 — Expo native.** Background location.
