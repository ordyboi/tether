# Phase 2 — headless crypto library (Issue #7)

## Context

Phases 1a/1b are merged: `docs/key-management-spec.md` fixes the wrap/epoch/ratchet mechanism,
`docs/precision-algorithm-spec.md` fixes the coarsening algorithm and its seven test vectors.
Phase 0b (issue #3) measured the primitives on device: AES-256-GCM via `expo-crypto` for v1, no
ChaCha20-Poly1305 fallback needed — but only on one device over one hour, so the AEAD still sits
behind one interface.

Nothing is implemented yet. This package is load-bearing for later phases: Phase 4's schema
stores what this package produces, Phase 7 seals fixes with it, Phase 5 wraps room keys with it.

The reason it is headless — plain TypeScript in Node, zero React Native imports — is stated in
the issue and worth repeating: bugs here are silent. A payload sealed under the wrong epoch key
does not crash; someone just can't see their partner on the map and blames the GPS. A Node test
loop is the only place these bugs are cheap to catch.

## Decisions taken

- **Location**: new workspace `packages/@tether/crypto`. Root `workspaces` glob gains
  `"packages/*"`.
- **AEAD**: both adapters (AES-256-GCM, ChaCha20-Poly1305) are implemented from day one. Both
  are pure JS via `@noble/ciphers`, so both run identically in Node now and in React Native
  later — the one-line swap is genuinely one line, not a stub. Node's built-in `crypto` appears
  only inside the AES known-answer test, cross-checking the Phase 0b vector. The real
  `expo-crypto` adapter lands in `apps/mobile` in a later phase, implementing the same
  interface.
- **Padding block**: 256 bytes.

### Scope note — "epoch key derivation"

The acceptance criteria say "epoch key derivation," but `key-management-spec.md` §2 is explicit
that room keys are independent, uniformly-random 256-bit values per epoch, not derived from one
another — a hash chain would let a removed member's device compute every future room key from
the last one it held. What *is* derived per epoch is the room-key **wrap** key (HKDF over the
X25519 shared secret, salted with device/room/epoch) and the ratchet seed (HKDF over the epoch's
room key). Implemented that way; this matches the spec, not the acceptance criteria's shorthand.

## Package layout

```
packages/crypto/
  package.json
  tsconfig.json
  src/
    index.ts
    random.ts                   RandomSource type + default CSPRNG
    bytes.ts                    byte/hex helpers
    encoding.ts                 canonical length-prefixed field encoding (AADs + HKDF salts)
    kdf.ts                      hkdfSha256
    aead/
      types.ts                  the Aead interface
      aes-gcm.ts                @noble/ciphers AES-256-GCM adapter
      chacha20-poly1305.ts      @noble/ciphers ChaCha20-Poly1305 adapter
      index.ts                  the one-line swap
    identity.ts                 X25519 keypair generation + scalar mult
    room-key.ts                 RoomKey, wrap/unwrapRoomKey envelope, sealUnderRoomKey/openUnderRoomKey
    invite.ts                   invite-secret wrap/unwrap (spec §4)
    ratchet.ts                  init, advance, re-randomize, seal/open (spec §7)
    padding.ts                  padFixPlaintext / unpadFixPlaintext
    coarsen.ts                  grid-snap + hysteresis (precision spec)
  vectors/phase0b.json           AES-GCM / X25519 / HKDF known-answer vectors
```

Tests are colocated as `*.test.ts` matching `apps/server/src/routes/health.test.ts`. Relative
imports carry the `.js` extension (NodeNext ESM).

## Key design points

### Canonical encoding (`encoding.ts`) is where the real bug lives

The specs write AADs and HKDF salts as things like `roomId || epoch || deviceId`. Implemented
naively as string concatenation this is ambiguous, and it's a real, exploitable bug: two
different logical contexts can produce identical bytes once concatenated without delimiters, so
a ciphertext bound to one context would authenticate under another.

One helper encodes an ordered list of fields as, for each field, a 4-byte big-endian length
prefix followed by the field's bytes — strings as UTF-8 of their canonical lowercase form,
integers as a fixed 8-byte big-endian encoding. Every AAD and every HKDF salt/info in this
package goes through it. This is the single most important thing to get right and to test,
because a mismatch between the sealing side and the opening side produces an auth-tag failure
that looks exactly like corruption.

### AEAD interface (`aead/types.ts`)

Promise-returning even though `@noble/ciphers` is synchronous — the eventual `expo-crypto`
adapter is async, and this interface, not the actual v1 AEAD, is the thing later phases code
against. Shape:

- `keyLength`, `nonceLength`, `tagLength` as readonly numbers.
- `seal(key, plaintext, aad, random)` returning `nonce || ciphertext || tag`.
- `open(key, sealed, aad)`.

`seal` draws its own nonce from the injected `RandomSource` and prepends it, so nonce reuse is
not expressible at any call site. `aead/index.ts` contains exactly one meaningful line —
`export const defaultAead = aesGcm;` — and that line is what the swap test changes.

### Running the full suite under both AEADs

Every function that seals takes its `Aead` as an explicit argument rather than importing a
singleton. Room-key, invite, and ratchet suites are parameterized with
`describe.each([aesGcm, chacha20Poly1305])`, so both AEADs genuinely execute every wrap, unwrap,
ratchet-seal, and ratchet-open path.

The Phase 0b AES known-answer vector is the one exception — it asserts exact ciphertext bytes,
which cannot pass under ChaCha. It lives in `aead/aes-gcm.test.ts`, standalone, not part of the
parameterized suite. The RFC 8439 ChaCha20-Poly1305 test vector lives alongside it in
`aead/chacha20-poly1305.test.ts` as its own known-answer test.

### Randomness injection

`RandomSource = (byteLength: number) => Uint8Array`. The production default wraps
`globalThis.crypto.getRandomValues`, which exists in Node 20+ and, per Phase 0b, is the same
surface `expo-crypto`/`react-native-get-random-values` polyfills on device. Every function that
needs entropy — room key generation, ephemeral keypairs, nonces, invite secret generation —
takes a `RandomSource` argument.

This is also what makes the Phase 0b AES vector assertable: feed a source that returns the
vector's fixed nonce, and the adapter reproduces the published ciphertext byte for byte.

### Padding (`padding.ts`)

256-byte block: 2-byte big-endian payload length, then the payload, then zero-fill to exactly
256 bytes. Max payload is 254 bytes (a lat/lng/accuracy/timestamp payload is comfortably under
that). Throws on overflow rather than truncating — a silently truncated location must never be
uploaded.

The property test asserts, for payloads of every length 0–254: output is always exactly 256
bytes regardless of input length, and `unpad(pad(p))` equals `p`. This is the invariant the
threat model leans on — uniform ciphertext size is what stops a database dump from
distinguishing an `always_precise` room's fixes from an `approximate_only` room's.

### Sealing under the room key isn't only for `fix` rows

`room.nameCiphertext` and `membership.displayNameCiphertext` are sealed under the room key too,
and `key-management-spec.md` §6 requires the room name to be re-sealed in the same transaction
as every epoch bump — the spec flags this as the thing an implementer forgets, because unlike a
`fix` (sealed once, at upload) the room name is long-lived state a departed member could
otherwise decrypt forever.

So `room-key.ts` exposes a plain `sealUnderRoomKey` / `openUnderRoomKey` pair alongside the
envelope wrap/unwrap. Both are built on `encoding.ts` AADs and are not padded — the padding
invariant in `AGENTS.md` is scoped to `fix` ciphertexts, and padding a room name to a fixed
block would be meaningless.

### State-bearing functions stay pure

Both the ratchet and the coarsening hysteresis carry state, and neither touches storage. Model
both as an explicit state object, returning `{ state, result }` — the caller (a later phase)
owns persistence. Per the AGENTS.md invariant, "unset until first fix" is modelled as
`CoarsenState | null`, not an optional field with an implicit sentinel.

Ratchet functions, mirroring spec §7: `initRatchet` (HKDF from the epoch's room key, salt
`authorAlias`, info `"precise-ratchet-init"`), `advanceRatchet` (HKDF over the previous key,
info `"precise-ratchet-advance"`, index + 1), `rerandomizeRatchet` (random seed, not derived
from the prior chain, generation + 1), and `deriveRatchetKeyAt` for a grantee walking forward
from a granted `(generation, index)`.

## Files changed outside `packages/crypto`

- `package.json` (root) — `workspaces` gains `"packages/*"`.
- `eslint.config.mjs` — add a `files: ["packages/**/*.ts"]` block; anything outside `apps/`
  currently has no rule overrides, so this mirrors the server block.
- Nothing in `apps/mobile` or `apps/server` changes in this phase.

New dependencies (in `packages/crypto` only): `@noble/curves`, `@noble/hashes`,
`@noble/ciphers`; dev: `vitest`, `typescript`, `@types/node`. Scripts `typecheck` (`tsc
--noEmit`) and `test` (`vitest run`) so the root `--workspaces --if-present` fan-out and CI pick
the package up automatically.

noble v2 moved hashes under `@noble/hashes/sha2.js` (not `.../sha256`) and `@noble/hashes/hkdf.js`,
and x25519 lives at `@noble/curves/ed25519.js` (not a standalone `x25519.js`). Verified against
the versions npm actually resolves (`2.4.0` for all three) rather than assumed from memory.

## TDD order

Per `AGENTS.md`, tests first at each step.

1. `encoding.test.ts` — ambiguity cases first (naive concatenation collisions that
   length-prefixing must not reproduce), then round-trips.
2. `padding.test.ts` — the property test and the overflow throw.
3. `coarsen.test.ts` — the spec §4 table, driven in projected meters; then the recommended
   property test (no cell change for points within `BUFFER_M` of each other on the same side of
   a boundary); then projection round-trip.
4. `kdf.test.ts` — RFC 5869 §A.1 test case 1.
5. `aead/aes-gcm.test.ts` — the Phase 0b AES known-answer vector with a fixed-nonce random
   source. `aead/chacha20-poly1305.test.ts` — the RFC 8439 vector.
6. `identity.test.ts` — RFC 7748 §5.2 test vector 1.
7. `room-key.test.ts` — wrap/unwrap round-trip; wrong device key fails; wrong epoch in the AAD
   fails (the silent-bug case the issue calls out); independence of keys across epochs.
8. `invite.test.ts` — round-trip from an invite secret; wrong secret fails.
9. `ratchet.test.ts` — advance is one-way (cannot derive i from i+1); a grant at index i opens i
   and everything after in the same generation; re-randomization breaks forward derivation and
   bumps the generation.
10. The parameterized `describe.each` wrapper that reruns 7–9 under both AEADs.

## Verification

```
git checkout -b feat/2-crypto-library
npm install
npm run format
npm run lint
npm run typecheck
npm test
```

Then, to prove the one-line swap: change `defaultAead` in
`packages/crypto/src/aead/index.ts` to `chacha20Poly1305`, rerun `npm test` (everything but the
two AES/ChaCha known-answer tests passes identically), and revert.

No device or dev server is involved — that is the point of this phase.

Commit with conventional commits; PR title `Issue #7: headless crypto library for room keys,
envelope wrapping, the precise-location ratchet, and location coarsening.`
