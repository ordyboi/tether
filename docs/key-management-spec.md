# Key management specification

Phase 1a. Written from the v1 PRD (§4, §5, §7, §9, §11) and the AGENTS.md invariants. This
document is the source for Phase 2 (crypto library) and Phase 4 (schema) — those sessions
should not need anything beyond this file, the PRD, and AGENTS.md.

Primitives, per the PRD's stack table: X25519 (`@noble/curves`) for key agreement, HKDF-SHA256
and HMAC (`@noble/hashes`) for derivation, AES-256-GCM with AAD (`expo-crypto`) for sealing.
`@noble/ciphers` ChaCha20-Poly1305 is the documented native-module fallback (§11 engineering
risks) and uses the same key sizes, so nothing below is AES-specific.

## 1. Device identity

- On first run, a device generates one X25519 keypair. The private scalar is written to
  `expo-secure-store` (Android Keystore-backed) and never leaves the device in any form —
  not in a backup, not in a log. The public key is uploaded as `device.identityPublicKey`.
- **Lifetime**: the keypair lives for the lifetime of the `device` row. It is not rotated
  under normal operation — rotating it would require re-wrapping every room key the device
  holds, for no security gain absent suspected compromise. Revocation is by `device.revokedAt`
  (see §5), not by rotation.
- A device that is revoked (removed) and later wants back in registers a fresh keypair and
  goes through join/link again; a revoked identity key is never reused.
- `device.lastSeenAt` and any other device metadata are irrelevant to key material and are not
  covered here.

## 2. Room keys and epochs

Each `room_epoch` row has an independent, uniformly-random 256-bit **room key**. Room keys are
**not** derived from one another (no hash chain across epochs). This is deliberate: a chain
would let anyone holding epoch *N*'s key derive epoch *N+1*, *N+2*, ... forward, which would
mean a removed member's device — which still holds the last epoch key it was issued — could
compute every future room key without ever receiving an envelope for it. Independent random
keys per epoch make removal actually cut off future access, not just future *envelope service*.

`room_key_envelope(roomId, epoch, deviceId, wrappedKey)` is how a room key reaches a device.
Wrapping is ECIES-style, device-to-device:

```
ephemeral_kp = X25519.generateKeyPair()
shared = X25519.scalarMult(ephemeral_kp.secretKey, device.identityPublicKey)
wrapKey = HKDF-SHA256(shared, salt = deviceId || roomId || epoch, info = "room-key-wrap")
wrappedKey = ephemeral_kp.publicKey || AES-256-GCM.seal(wrapKey, roomKey, aad = roomId || epoch || deviceId)
```

The device decrypts with `X25519.scalarMult(device.identitySecretKey, ephemeral_pubkey)` fed
through the same HKDF. Ephemeral keys are discarded after wrapping; they exist only to avoid
a static-static ECDH with the room's "issuing" device (there isn't one fixed issuer — see §3).

### Room creation

The creating device generates `roomKey_0` at random, wraps it to itself, and writes
`room_epoch(roomId, 0, reason='created')` plus its own envelope. `room.currentEpoch = 0`.

## 3. Envelope issuance rules

- An envelope for `(roomId, epoch, deviceId)` is issued **only** if that device's membership
  has `joinedEpoch <= epoch` and (`removedAt` is null or `removedAt` came after `epoch` was
  minted). This is the invariant: envelopes are only issued for epochs at or after a member's
  `joinedEpoch`.
- Because room keys are independent per epoch (§2), a device that was never issued an envelope
  for epoch *N* has no cryptographic path to `fix` rows sealed under epoch *N*, even if it
  later learns the ciphertext. History is unreadable by construction, not by server-side
  filtering.
- **Who mints a new epoch's key**: whichever active device is performing the mutation that
  triggers the bump (join, remove, guest join, guest removal). That device already holds the
  current room key (it's an active member, or — for the join case — it just derived one, see
  §4), generates a fresh random key for the new epoch, and wraps it to every device that will
  be active *as of* the new epoch (i.e. every non-removed membership with `joinedEpoch <=
  newEpoch`). There is no single "room key server" device; minting authority follows from
  already holding the current key, not from role.
- The server's job is narrower than it looks: store envelopes, serve them to the device named
  in each row, and never possess a room key itself. It cannot verify that an issuer wrapped
  correctly to the *right* recipients — that trust boundary is exactly membership + role
  checks enforced in the app layer (owner/admin required to remove; see §5).

## 4. Member add (invite redemption)

Invite links are `https://.../join/<token>#<inviteSecret>`. Per the invariant, the fragment
never appears in a request, a log, or a server test fixture — everything after `#` is
interpreted client-side only.

**Schema addition** (not in the PRD's §7.2 table — this is the gap the PRD flags for this
document to fill): `invite` gains two columns, `wrappedRoomKey` and `wrappedRoomKeyEpoch`.
Neither is derivable from `tokenHash`, and neither is decryptable server-side.

At invite creation, the issuing device:

```
inviteSecret = random(32)                                    // lives only in the URL fragment
inviteWrapKey = HKDF-SHA256(inviteSecret, salt = roomId, info = "invite-key-wrap")
wrappedRoomKey = AES-256-GCM.seal(inviteWrapKey, roomKey_current,
                                   aad = roomId || currentEpoch || inviteId)
```

`token` (the path component) is a separate random value; the server stores `tokenHash =
SHA-256(token)` as it already does, purely for invite lookup and revocation. `inviteSecret`
is never sent to the server in any request — only embedded in the fragment, which the sharer
distributes out-of-band (Play Install Referrer, share sheet, QR).

At redemption, the joining device:

1. Fetches invite metadata by `token` (role, expiry, `wrappedRoomKey`, `wrappedRoomKeyEpoch`).
2. Derives `inviteWrapKey` from the fragment's `inviteSecret` and unwraps `roomKey_current`.
   This gives immediate read access to whatever epoch the invite was minted for — the joiner
   can render the room before their own membership/envelope exists server-side.
3. Generates its own device identity keypair (if it doesn't already have one for this account)
   and uploads `identityPublicKey`.
4. Submits the join: server creates the `membership` row (`joinedEpoch = newEpoch`,
   `role` from `invite.grantsRole`), bumps `room_epoch` (`reason = 'member_joined'` or
   `'guest_joined'`), sets `room.currentEpoch = newEpoch`.
5. The joining device — which already holds `roomKey_current` from step 2, i.e. the epoch
   immediately before the bump — mints `roomKey_newEpoch` itself and wraps it to every active
   device, including its own and every existing member's device (fetched via their
   `identityPublicKey` rows). This makes join self-service: it does not require the admin (or
   any other existing member) to be online.

Guest join follows the same path with `role = 'guest'` and no further branching — guests are
members for key-management purposes; their scoping to one room is a product/authorization
rule, not a key-management one.

## 5. Member and guest removal

Removal requires owner/admin role (app-layer check; the server rejects a removal request from
a non-privileged membership). The acting device:

1. Sets `membership.removedAt = now()` for the target.
2. Mints `roomKey_newEpoch` at random and wraps it to every remaining active device (any
   membership with `removedAt` still null, `joinedEpoch <= newEpoch`) — the removed member's
   device(s) are simply excluded from the wrap set.
3. Bumps `room_epoch` (`reason = 'member_removed'` or `'guest_removed'`), `room.currentEpoch
   = newEpoch`.
4. Sets `device.revokedAt` for every device belonging to the removed membership's user, scoped
   to that room only where the user has other rooms — a device isn't globally revoked by being
   removed from one room, only its envelopes for *this* room stop coming.

This secures **future** confidentiality only. A removed member already saw whatever they saw
before removal — rekeying does not, and cannot, revoke knowledge already obtained. That's a
property of removal, not a gap in this design.

`room_key_envelope` rows for epochs a device no longer needs (its own past epochs after it's
been re-issued a newer one, or all epochs once revoked) are reclaimed by the sweeper (§4.6.7
in the PRD's schema notes — background jobs), not deleted synchronously at removal time.

## 6. Rekey on precision-policy-relevant events

There is no rekey path outside §4 and §5. Precision policy is immutable after creation (see
the AGENTS.md invariant), so there's no "policy changed" event to rekey against. Room name
re-sealing rides the same epoch bump: `room.nameCiphertext` is re-sealed under `roomKey_new`
by whichever device mints the epoch, using `room.nameEpoch` to track which key currently seals
it. This must not be forgotten by an implementer, because unlike `fix` (which is only ever
sealed once, at upload), the room name is long-lived plaintext-equivalent state that a departed
member could otherwise still decrypt forever if a separate label key were used instead. Whoever
implements §4 step 5 and §5 step 2 re-seals the name in the same transaction as the envelope
wrap.

## 7. The precise-location ratchet (`on_request` rooms only)

Only relevant when `room.precisionPolicy = 'on_request'`. `always_precise` seals
`fix.preciseCiphertext` directly under the epoch's room key, exactly like
`approximateCiphertext` — no ratchet, no `ratchetIndex`. `approximate_only` never populates
`preciseCiphertext` at all. The ratchet exists solely to let an author grant *some* requesters
access to precise fixes without handing out the room key itself (which would give unlimited
retroactive and future precise access to everyone).

**Schema addition**: `fix` and `precision_grant` both need a `ratchetGeneration` column (int,
default 0) alongside the existing `ratchetIndex`. This is the "home in the schema" the PRD
explicitly says doesn't exist yet (§11) — a grant is meaningless without something to check it
against, and index alone can't distinguish "not yet reached" from "already invalidated."

### Chain state

Per `(roomId, authorAlias, epoch)`, the author's device holds a ratchet key, seeded fresh
whenever the epoch bumps (tying ratchet lifetime to rekey, so there is exactly one lifecycle
to reason about, not two independent ones):

```
ratchetKey[0] = HKDF-SHA256(roomKey_currentEpoch, salt = authorAlias, info = "precise-ratchet-init")
```

### Advance (every precise upload)

Each time the author uploads a new precise fix, the ratchet advances by one — this *is* the
"author re-randomizes it" moment in the everyday sense (a new position each upload), and it's
one-way:

```
ratchetKey[i+1] = HKDF-SHA256(ratchetKey[i], info = "precise-ratchet-advance")
fix.preciseCiphertext = AES-256-GCM.seal(ratchetKey[i+1], precisePosition, aad = roomId || authorAlias || epoch || ratchetGeneration || (i+1))
fix.ratchetIndex = i + 1
fix.ratchetGeneration = <current generation, unchanged>
```

A device holding `ratchetKey[i]` can derive `ratchetKey[i+1], [i+2], ...` — forward only, never
backward. This is what "a grant unlocks everything from that index" means concretely: a grant
issued at index *i* lets the requester decrypt fix *i* and every later fix in the same
generation, but nothing before *i*.

### Re-randomization (explicit chain reset, distinct from ordinary advance)

Two triggers reset the chain to an independently random seed (breaking forward derivability
from the old chain entirely) and increment `ratchetGeneration`:

1. **Epoch bump** (§4, §5) — automatic, folded into the rekey.
2. **Manual reset** — the author explicitly cuts off every outstanding grant at once (a
   "stop sharing precise with everyone right now" action), independent of any individual
   grant's `expiresAt`.

```
ratchetGeneration += 1
ratchetKey[0] = random(32)   // NOT derived from the prior chain
```

### Grants and staleness detection

`precision_request` → approval creates `precision_grant(fromAlias, toAlias, ratchetIndex,
ratchetGeneration, expiresAt)`, capturing the chain position and generation at approval time.
The requester's device derives forward from `(ratchetGeneration, ratchetIndex)` as new fixes
arrive.

When the author re-randomizes (manual reset above), the acting device sets `revokedAt = now()`
on every currently-active `precision_grant` row where `fromAlias` matches, as part of the same
mutation. This is how a requester learns their grant is dead: not by failing to derive a key
(which would be silent and look like a network glitch), but by an explicit, observable
`revokedAt`. An epoch-bump reset does the same for consistency, even though membership changes
already imply every outstanding grant scoped to the old epoch is unreachable.

`expiresAt` (ordinary time-based expiry) and `revokedAt` (explicit cutoff) are independent and
both checked; either being past/set means the grant is dead. Grant window duration is a product
decision left to prototyping per the PRD (§6.6) — this document only fixes the mechanism.

## 8. Multi-device and key backup — one model

The PRD is explicit (§11) that these must not be specified independently: backup is the only
route to a second device, so a design that solves one without the other supports neither.

### Linking a second device while the first still works

1. Device B signs in (passkey/OAuth — same `userId` as device A) and generates its own
   identity keypair locally. It has no room keys yet.
2. Device B registers itself server-side as pending-link for that `userId`.
3. Device A, seeing a pending device for its own account, walks every room the user is a
   member of and, for each, wraps the room's current key to B's `identityPublicKey` (same
   ECIES wrap as §2), writing the envelope. No epoch bump is needed — this is issuing an
   existing epoch's key to an additional device, not minting a new one.
4. Once B holds an envelope for every room, linking is complete. Device A must be online for
   this; there is no server-mediated device linking that bypasses an already-trusted device.

### Recovering when the only device is lost

This is the case backup exists for. Backup is **of the device**, not of individual room keys
kept separately in sync — the payload is:

```
backup = { deviceIdentityPrivateKey, rooms: [{ roomId, epoch, roomKey }, ...] }
```

captured as of whenever the user last triggered/refreshed a backup (prompted per PRD §6.7, at
first successful map view). Two storage options, same payload shape:

- **Local encrypted backup**: `backup` sealed under a key derived from a user-chosen
  passphrase (scrypt or PBKDF2 via `@noble/hashes`, not a fixed system key — a phone-local file
  is worthless as a backup if reading it back only requires reading the phone).
- **Google Drive E2EE backup**: identical sealing, ciphertext uploaded to the app-data scope of
  Drive. Google stores opaque bytes; the passphrase never leaves the device.

Restoring on a new physical device: sign in (re-establishes `userId` via OAuth/passkey),
fetch the ciphertext (local file share-in, or Drive appdata), decrypt with the passphrase,
import `deviceIdentityPrivateKey` into Secure Store, and register a new `device` row **using
that same identity public key**. Any `room_key_envelope` ever wrapped to that public key —
including ones minted after the backup snapshot, if the old device was still receiving them
up to the moment it was lost — remains valid, because envelopes are keyed by device identity,
not by device row id.

For rooms rekeyed *after* the backup snapshot (an epoch bump happened between backup and
loss), the recovered `roomKey` for that room is stale. This resolves automatically the next
time any current active device processes a mutation for that room (§4/§5 step wraps to every
active device including the restored one, since its membership was never removed) — no special
recovery-path logic needed, it's the same "any current device can bring a stale device current"
property that makes linking work. Until that next mutation, the restored device can read
everything up to its last backed-up epoch and nothing newer; this is a visible, honest gap, not
silent data loss. Auto-refreshing the backup on every rekey (so the gap trends toward zero) is
noted as a v2 hardening, not required for v1 correctness.

Losing the device *and* never having taken a backup means the identity key is gone forever —
per the PRD, this is by design: there is no server-side key escrow to fall back to, and the
outcome (new identity, re-invite to every room) is the accepted cost of that guarantee, not a
bug in this spec.
