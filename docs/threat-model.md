# Threat model, long form

Phase 1c. Expands PRD §2, which sets the framing (in scope: the operator, brokers, casual
server-side access, subpoena; out of scope: nation-states, targeted device compromise, network
traffic analysis, platform collusion) but stops at a table of accepted residual leaks. This
document works through what each of four concrete vantage points — day-to-day operator access,
a full database dump, a stolen unlocked phone, and a subpoena — actually yields, table by
table and field by field where it matters. It does not restate §2's scope decisions; it applies
them.

Schema references are to §7.2 of the PRD (`user`/`session`/`account` come from Better Auth,
§7.1).

## 1. Operator, day to day

This is what's visible with no breach at all — the access the person running the service has
by default, using the service normally.

- **Social graph shape**: which anonymous accounts share a room (`membership`), how many rooms
  exist, how many members per room, role distribution (owner/member/guest). Not who they are —
  `membership.userId` is a UUID, `memberAlias` is a per-room pseudonym — but the shape itself
  (a room with a 2-person and a 4-person cluster, say) is visible and accepted as a residual
  leak (PRD §2 table).
- **Timing and volume**: every `fix` upload, every `precision_request`/`precision_grant`
  action, every session, timestamped (minute-rounded for `fix.serverReceivedAt`, ordinary
  precision elsewhere). Adaptive upload cadence means this timing correlates with movement —
  an operator watching upload frequency for a given alias can infer "this person is moving"
  without ever decrypting a coordinate. Accepted, not mitigated in v1 (PRD §4, §9).
- **Push metadata**: FCM token per device, ping timestamps, ping volume — visible to us and to
  Google, never the content (§8, data-only payloads through one wrapper function).
- **OAuth subject IDs**: `account.accountId` is the one field the PRD calls "the one
  irreducible link" (§6.1) — it ties an account to a real Google/Apple identity, but only
  Google/Apple can resolve it to a person; we hold an opaque ID.
- **Invite lifecycle**: `invite.createdBy` is a real `userId`, so "who has issued invites, how
  many, how often" is plainly visible — this is ordinary operational data, not a leak of room
  content, but it is a real-identity-linked activity log and should be named as one.
- **What is not visible**: any room name, any display name, any location coordinate, any
  precise-vs-approximate content. These never exist in a form the server can read — they're
  sealed client-side before upload, under keys the server never holds (key management spec §2,
  §7). This is the load-bearing claim in PRD §3's positioning and it holds under ordinary
  operation because there's no server-held key that would let it not hold.

## 2. Full database dump

A static snapshot — every row in every table, no device access, no live server process. This
is the "someone reading the schema" scenario PRD §3 says the positioning claim must survive.

**What a dump cannot yield, under any circumstance, without also compromising a device**: room
names, display names, approximate or precise coordinates, ratchet-sealed content. Every
ciphertext column (`room.nameCiphertext`, `membership.displayNameCiphertext`,
`fix.approximateCiphertext`, `fix.preciseCiphertext`) is sealed under a room or ratchet key
that only exists on member devices (key management spec §2, §7) — `room_key_envelope.wrappedKey`
is present in the dump but is itself ciphertext, wrapped to a device's X25519 public key; the
matching private key is not in the database, full stop. A dump alone is a set of opaque blobs
for all of these columns.

**What a dump does yield**:

- Everything in §1 above, all at once and retroactively, rather than observed live — the full
  history of graph shape, timing/volume, invite issuance, role, and removal (`membership.
  removedAt`, `room_epoch.reason`) for every room that ever existed. `fix` is hard-deleted at
  24h and `room_key_envelope` rows are swept once stale, so a dump's *location-adjacent*
  metadata (which epochs existed, when) is bounded to roughly the last day plus whatever epoch/
  envelope history hasn't been swept yet — not the full room lifetime.
- Ciphertext *sizes* are uniform by design (padding invariant), so blob length does not
  distinguish an `approximate_only` room's fixes from an `on_request` room's, or reveal whether
  a given fix has a live precise grant riding on it. This is exactly the property PRD §7.3
  calls out ("without it, blob size distinguishes approximate_only from on_request rooms and
  may reveal a live grant") — worth stating plainly here because it's a property the *dump*
  scenario specifically depends on; the padding has to have actually happened for this
  paragraph to be true, not just be a design intention.
- `device.lastSeenAt` (day-coarsened), `device.platform`, `device.pushToken` per user — device
  fleet composition per account, at day granularity.

### The membership correlation point

`membership` holds `userId` and `memberAlias` in the same row. This is the honest limitation
the PRD itself names (§7.3): the alias buys pseudonymity in the high-volume tables (`fix`,
`precision_request`, `precision_grant` reference aliases, never user IDs — one of the
AGENTS.md invariants), but it does not buy unlinkability, because de-anonymizing every alias a
given `userId` has ever used, across every room, is one join away:

```sql
SELECT roomId, memberAlias FROM membership WHERE userId = $target;
```

Given that alias list, every `fix`, `precision_request`, and `precision_grant` row authored or
targeted by this person, in every room, is trivially selectable — still without decrypting a
single coordinate, but with full identity attribution of *who requested/granted/uploaded
what, when*. This is the sharpest single finding in a dump: it does not cost an attacker
anything beyond one indexed join to turn "an anonymous alias did X" into "user U did X." Any
future hardening that claims stronger unlinkability (PRD §10, "anonymous credentials to break
request-time alias correlation," listed as out-of-v1) would need to close exactly this join,
not add more aliasing elsewhere.

## 3. Stolen unlocked phone

Out of scope for defense (PRD §2 explicitly declines to defend against device compromise), but
the AC for this document asks what it *yields*, which is worth being honest about since the
app's own UI is the fastest path to most of it — no forensics required.

- **Everything the app can currently render**: every room the device's account is a member of,
  at whatever epoch that device currently holds a key for — room names, member display names,
  live and cached location for every visible member, in plaintext, because that's the app
  working as intended for its logged-in user.
- **Secure Store contents**: the device's X25519 identity private key (Android Keystore-backed,
  but "unlocked" means the OS has already authorized app access — hardware backing protects
  against extraction, not against use while unlocked) and whatever `room_key_envelope` keys are
  currently cached/unwrapped for active rooms.
- **Ability to act as the device**: until `device.revokedAt` is set by an admin on another
  device, the stolen device can upload fixes, respond to precision requests, and otherwise act
  with full membership privileges for every room it belongs to — this is a live session, not
  just a data-at-rest exposure.
- **Local encrypted backup file, if one exists on-device**: per the key management spec §8,
  this is sealed under a user-chosen passphrase distinct from anything Keystore-protected — so
  an unlocked-phone attacker who does not also know the passphrase does not get anything extra
  from the backup file beyond what the running app already exposes. If the user reused a weak
  or guessable passphrase, that protection is only as strong as the passphrase; this document
  does not assume a strong passphrase was chosen, only notes that the mechanism is independent
  of device unlock state.
- **What this does not yield beyond the current device's own scope**: other family members'
  devices, rooms this account isn't in, or (per key management spec §5) any room the account
  was already removed from before theft — removal revokes future envelopes, and a stolen phone
  only has what it already held.

This section documents exposure; it recommends no mitigation, consistent with PRD §2 treating
targeted device compromise as explicitly out of scope.

## 4. Subpoena / legal request

What we could actually hand over, given §1–§3 establish what exists to hand over at all. This
section is the one the positioning claim (PRD §3, "little to misuse... little to hand over")
has to be judged against most directly, because a subpoena is a real, in-scope adversary (PRD
§2, "goal is that there is very little to hand over") — unlike §3's stolen-phone scenario.

**Can be produced**:

- Account existence, creation date, session activity timestamps (with `ipAddress`/`userAgent`
  already null per the nulling-on-write invariant — there is no historical IP log to produce
  because none was ever written, not because it was deleted after the fact).
- OAuth subject ID (`account.accountId`) — links the account to a real Google/Apple identity,
  but only Google or Apple can resolve that link to a name; we hand over an opaque ID that is
  meaningful only in combination with a separate, independent legal request to the OAuth
  provider.
- Room membership shape for the named account: via the §2 correlation join, every room the
  named `userId` belongs to, their `memberAlias` in each, join/removal dates, role. **This is
  the honest weak point**: a subpoena naming a specific user *does* get their room-by-room
  membership shape and, via the alias, every metadata row (timing, requests, grants — not
  content) they generated, using the exact join described in §2. The claim was never that
  membership itself is protected from a named-user request — only that content (names,
  positions) is.
- Push token history and FCM ping timing/volume for the named account's devices.
- Invite issuance history where the named account is `createdBy`.

**Cannot be produced, because it does not exist anywhere in recoverable form**:

- Any room name or member display name (sealed, no server-held key).
- Any location coordinate, approximate or precise, for any fix ever uploaded (sealed, no
  server-held key; and anything past 24h is hard-deleted regardless).
- Any precise-location ratchet key or the content it protected.
- A real name or email for the account — `user.name`/`user.email` are synthetic per the OAuth
  PII-stripping rule (PRD §6.1); a subpoena against these fields yields the synthetic values,
  not the real ones, unless correlated externally via the OAuth subject ID.

**Net honest statement**: a subpoena naming a specific person gets their activity graph and
timing across every room, in full — that is a real, meaningful disclosure and should not be
undersold. It does not get any content a room's members actually see when they open the app.
The positioning copy in PRD §3 ("we don't know your name or your room names") holds under this
scenario; a broader claim of "we know nothing about you" would not, and PRD §3 already warns
against making that stronger claim.
