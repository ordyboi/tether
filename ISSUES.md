# PR #27 review — `@tether/crypto`

Adversarial review of `feat/2-crypto-library` (commit `545a40e`) against `docs/key-management-spec.md`,
`docs/precision-algorithm-spec.md` and `AGENTS.md`.

Everything below was checked against a running copy of the branch, not read off the diff. Where a
finding says *verified*, a probe test was written, run, and then deleted; where a deletion says
*verified*, the deletion was actually applied and `tsc --noEmit` + the full 44-test suite were rerun
green before reverting.

Baseline on arrival: 44/44 passing, typecheck clean.

Work the sections in order — C1 is a privacy bug that defeats the feature this package exists for.

---

## C — Correctness and security

### C1. `coarsen()` leaks the user's exact latitude through the "coarse" longitude — up to 764m of a 1000m cell

`packages/crypto/src/coarsen.ts:83`

```ts
return { state: nextState, point: unprojectFromMeters(center.x, center.y, lat) };
//                                                                       ^^^ raw fix latitude
```

The cell centre's `x` is divided by `cos(refLat)`, and `refLat` is passed the **user's true
latitude** rather than the cell centre's. The reported longitude is therefore a continuous function
of the real position: two people standing in the same cell emit different coordinates, and one
person moving within a cell emits a moving point. The whole premise of grid-snapping — stated in
`precision-algorithm-spec.md` §Decision, "a grid cell reveals only *somewhere in this square*, which
stays true no matter how many times it's observed" — does not hold. A repeated-observation attacker
(the server sees every `approximateCiphertext` upload under `approximate_only`) inverts it and
recovers true latitude to within metres.

**The spec says the implementation is wrong.** `precision-algorithm-spec.md` §2:

> `refLat` for unprojection is the cell's own center latitude (self-consistent — the projection and
> its inverse use the same lat for the `cos` term …)

The spec's *pseudocode* three lines later contradicts its own prose and passes `lat`; the
implementation followed the pseudocode. Fix the code, and fix the pseudocode in the spec so the next
reader doesn't reintroduce it.

Verified — coarse-longitude spread while remaining inside a single cell, walking north in 50m steps:

| Location | In-cell spread of the "coarse" longitude |
|---|---|
| London (51.5, −0.12) | 0.3 m |
| Tokyo (35.68, 139.7) | 214.8 m |
| Reykjavík (64.14, −21.94) | 312.5 m |
| Nordkapp (71.0, 25.78) | 300.1 m |
| Sydney (−33.87, 151.21) | 740.5 m |
| **New York (40.71, −74.006)** | **763.7 m of a 1000 m cell** |

The error scales with `|x| ≈ |lng| · 111320 · cos(lat)`, so it is near-zero at the prime meridian
(which is why London-based manual testing would never show it) and worst at high absolute longitude.
The spec's parenthetical "a 1km cell's latitude span is too small for that choice to matter" is the
reasoning error — the sensitivity depends on absolute longitude, not on cell size.

Two further consequences of the same line:

- `coarsen()` is **not idempotent**: `coarsen(coarsen(p)) ≠ coarsen(p)`.
- The spec's own §Decision claim about resisting averaging attacks is false as implemented.

Fix (verified: restores exactly one distinct output per cell at all six locations above, makes the
function idempotent, and the reported centre still reprojects into the cell it claims):

```ts
export function coarsen(lat: number, lng: number, state: CoarsenState | null): CoarsenResult {
  const { x, y } = projectToMeters(lat, lng);
  const { state: nextState, center } = coarsenProjected(x, y, state);
  const centerLat = center.y / 110_540;
  return { state: nextState, point: unprojectFromMeters(center.x, center.y, centerLat) };
}
```

Add a regression test asserting the property that actually matters, which no current test covers:
*every* point inside one cell maps to one identical output. See T1.

### C2. `encodeFields` silently lowercases every string, collapsing distinct identifiers

`packages/crypto/src/encoding.ts:22` — `utf8ToBytes(field.value.toLowerCase())`

This normalisation appears nowhere in `key-management-spec.md`; it was invented here. It applies to
`roomId`, `deviceId`, `inviteId` and `authorAlias`, in both AAD construction and HKDF salts.

Verified consequences:

- `encodeFields([stringField("Alex")])` is byte-identical to `stringField("alex")`.
- `initRatchet(roomKey, "Alex").key` equals `initRatchet(roomKey, "alex").key` — two distinct authors
  share one ratchet chain, so **a precision grant issued for one decrypts the other's precise fixes**.
  That directly breaks the §7 guarantee that a grant is scoped to one author.
- Any case-sensitive id space collapses: `"aB3xY"` and `"Ab3Xy"` produce the same AAD. base64url
  tokens and case-sensitive ULIDs are both affected.

The AAD is supposed to bind a ciphertext to exactly one `(room, epoch, device/author)` tuple. Case
folding makes that binding many-to-one, which is a domain-separation failure, and it is the kind that
stays invisible until two users pick names differing only by case.

Remove `.toLowerCase()`. If some caller genuinely needs case-insensitive ids, normalise at the
boundary that owns the id, not inside the crypto layer's byte encoder. Then delete the test at
`encoding.test.ts:28` that currently pins this behaviour in place (it asserts the bug is a feature).

### C3. `deriveRatchetKeyAt` walks an attacker-controlled counter with no bound — device-freezing DoS

`packages/crypto/src/ratchet.ts:51-55`

```ts
let key = grantKey;
for (let i = grantIndex; i < targetIndex; i++) key = advanceRatchetKey(key);
```

`targetIndex` is `fix.ratchetIndex`, which per spec §7 arrives **from the server**, and the threat
model does not treat the server as trusted for integrity of this field. There is no upper bound, so
one row with a large `ratchetIndex` pins the CPU indefinitely. Nothing else validates it first.

Verified: 200,000 iterations took 2,171 ms in Node on this machine (~10.9 µs each). A `ratchetIndex`
of `2^31` extrapolates to **~6.5 hours** of blocked computation — on a phone, worse, and it is
synchronous, so it takes the JS thread with it.

Fix: bound the skip and reject beyond it, e.g.

```ts
export const MAX_RATCHET_SKIP = 10_000;
if (targetIndex - grantIndex > MAX_RATCHET_SKIP) {
  throw new Error("ratchet skip exceeds the maximum derivable window");
}
```

Pick the constant from the real upload cadence (an `on_request` room uploading a precise fix per
minute reaches ~1,440/day, so 10k covers about a week of catch-up) and state that reasoning in a
one-line comment — it is a decision a future reader cannot re-derive.

### C4. `initRatchet`'s `generation` argument does not affect the derived key

`packages/crypto/src/ratchet.ts:21-25`

```ts
export function initRatchet(roomKey: RoomKey, authorAlias: string, generation = 0): RatchetState {
  const salt = encodeFields([stringField(authorAlias)]);
  const key = hkdfSha256(roomKey, salt, RATCHET_INIT_INFO, RATCHET_KEY_LENGTH);
  return { key, index: 0, generation };   // `generation` is stored, never mixed in
}
```

`initRatchet(rk, "a", 0)` and `initRatchet(rk, "a", 7)` return the **same key**. The parameter looks
like it seeds a fresh chain and does not. Today the only reset path that produces new key material is
`rerandomizeRatchet` (which draws from the RNG), and epoch bumps change `roomKey`, so this is latent
rather than currently exploitable — but it is a loaded gun: any future caller that re-inits with a
bumped generation under an unchanged room key silently rebuilds the identical chain, defeating the
"manual reset cuts off every outstanding grant" guarantee in spec §7.

Either bind it — `encodeFields([stringField(authorAlias), uint64Field(generation)])` — or drop the
parameter and have the caller construct the state. Binding it is the safer default and costs nothing.
Note that `generation` is already in the seal AAD (`ratchetAad`), so the two would then agree.

### C5. `hexToBytes` silently accepts non-hex input

`packages/crypto/src/bytes.ts:30-39` — `parseInt("zz", 16)` is `NaN`, and assigning `NaN` into a
`Uint8Array` stores `0`.

Verified: `hexToBytes("zzzz")` → `[0, 0]`; `hexToBytes("  ff")` → `[0, 255]`. A malformed key or
vector becomes a valid-looking all-zero buffer instead of an error. Currently only test code feeds
it, but it is exported from the package index as public API.

This is fixed for free by D1 below — `@noble/hashes/utils` already ships a `hexToBytes` that rejects
with `hex string expected, got non-hex character "zz" at index 0`.

### C6. No length validation before slicing sealed inputs

`room-key.ts:59-60` and both AEAD `open` implementations slice by fixed offsets with no minimum-length
check. `unwrapRoomKey` on a 10-byte buffer produces a 10-byte "ephemeral public key" and an empty
ciphertext. In practice `@noble` throws on the malformed key or the failed tag, so this is a
robustness/error-message issue rather than a vulnerability — but the thrown message is misleading, and
one explicit guard per entry point makes truncation diagnosable:

```ts
if (wrappedKey.length < EPHEMERAL_PUBLIC_KEY_LENGTH + aead.keyLength) {
  throw new Error("wrapped room key is truncated");
}
```

### C7. Unguarded polar and antimeridian inputs

`coarsen.ts:22` divides by `cos(refLat)`, which is 0 at the poles. Verified: `coarsen(90, 10, null)`
returns `lng: 73352674062142.33`. Also, two points ~200m apart either side of the antimeridian land in
cells ~20,000 apart and never merge.

Low priority — neither is a plausible location for this product — but both currently produce silent
garbage rather than an error. One guard clause, or a documented "callers pass real GPS fixes" note, is
enough. Do not build antimeridian wrapping unless a real requirement appears.

---

## D — Deletions (all verified: applied, `tsc --noEmit` clean, 44/44 still green, then reverted)

Roughly **119 lines removable with zero behaviour change**, net ~80 after the one new file in D2.

### D1. `bytes.ts` reimplements four functions that a direct dependency already exports — −31 lines

`@noble/hashes/utils` (already a dependency via `@noble/hashes ^2.4.0`) exports `bytesToHex`,
`hexToBytes`, `concatBytes` and `utf8ToBytes` with the same signatures. Verified: the whole of
`bytes.ts` collapses to

```ts
export { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export function uint32BE(value: number): Uint8Array { /* unchanged */ }
export function uint64BE(value: bigint): Uint8Array { /* unchanged */ }
```

43 lines → 12, typecheck clean, 44/44 pass. Only `uint32BE`/`uint64BE` are actually Tether-specific.
This also fixes C5 for free, since noble's `hexToBytes` validates.

### D2. The two AEAD adapters are byte-identical apart from the cipher function — −18 net

`aes-gcm.ts` and `chacha20-poly1305.ts` are 24 lines each and differ only in which `@noble/ciphers`
function they call. Both collapse into one 30-line `noble-aead.ts` exporting both instances via a
small factory. Verified green including both known-answer tests. Delete the two files.

### D3. `defaultAead` is written once and never read — −5 lines, and it invalidates a test-plan claim

`aead/index.ts:5-7`. Nothing in `packages/`, `apps/`, or any test imports `defaultAead`; every
function takes `aead` as a parameter. So the PR description's

> Manually swapped `defaultAead` to `chacha20Poly1305` …, reran `npm test`, confirmed all non-KAT
> tests pass identically

proves nothing — no test reads the symbol, so the swap could not have changed any result. The tests
already exercise both AEADs directly via `test-support/aeads.ts`. Delete the export; reintroduce a
default at the call site that actually needs one (`apps/mobile`, later phase).

### D4. `Aead.nonceLength` and `Aead.tagLength` are never read — −6 lines

Declared on the interface and set by both adapters; nothing consumes either. Each adapter uses its own
module-local `NONCE_LENGTH` constant instead. `keyLength` *is* used (`room-key.ts`, `invite.ts`) —
keep it, delete the other two and their `TAG_LENGTH`/`NONCE_LENGTH` constants where they become unused.

### D5. `sealUnderRoomKey` / `openUnderRoomKey` are pure pass-throughs — −19 lines

`room-key.ts:66-83`. Both just forward to `aead.seal`/`aead.open` with the arguments reordered and add
no AAD, no derivation, nothing. (Contrast `sealRatcheted`/`openRatcheted`, which build the AAD and do
earn their place.) The one test using them works unchanged when pointed at `aead.seal`/`aead.open`.

### D6. `PLAN.md` (216 lines) does not belong in the repo

A session's working plan committed to the repo root. The durable decisions in it are already in
`docs/key-management-spec.md` and `docs/precision-algorithm-spec.md`; the rest is scaffolding that
will rot. The one genuinely new piece of reasoning — the "Scope note — epoch key derivation"
explaining why room keys are *not* chained — is worth keeping, but it is already stated in
`key-management-spec.md` §2. Delete the file.

### D7. Duplicate ESLint block — −6 lines

`eslint.config.mjs`: the new `packages/**/*.ts` block has rules byte-identical to the existing
`apps/server/**/*.ts` block. Merge into one entry with
`files: ["apps/server/**/*.ts", "packages/**/*.ts"]`.

### D8. Narrow the package's public surface

`src/index.ts` re-exports every module wholesale, so `uint32BE`, `distanceToCellRect`,
`coarsenProjected`, `projectToMeters` and `unprojectFromMeters` are all public API. Several exist only
so tests can reach them. Export what consumers need; leave the rest module-local. This is cheap now
and expensive once Phases 4/5/7 import the package.

---

## T — Tests that should not exist

The suite is 44 tests, and a meaningful share assert either tautologies or the behaviour of
`@noble`. Worse, two of them are named for properties they do not test, which is how C1 shipped.

### T1. `coarsen.test.ts:45` — "deterministic and stable for a repeated fix" tests nothing, and hid C1

```ts
const first = coarsen(lat, lng, null);
const second = coarsen(lat, lng, first.state);
expect(second.point).toEqual(first.point);
```

Same input twice, same output — that is purity, which is guaranteed by construction. The property the
name promises, and the one that actually matters, is *different* points in one cell producing one
identical output. That property is false (C1) and this test's name is precisely why nobody noticed.

Replace it with the real property. Suggested, and confirmed failing on current `main` and passing
against the C1 fix:

```ts
it("every point inside one cell coarsens to the same point", () => {
  const first = coarsen(40.71, -74.006, null);
  let state = first.state;
  for (let i = 1; i <= 10; i++) {
    const r = coarsen(40.71 + (i * 50) / 110_540, -74.006, state);
    if (r.state.currentCellX !== first.state.currentCellX) break;
    if (r.state.currentCellY !== first.state.currentCellY) break;
    state = r.state;
    expect(r.point).toEqual(first.point);
  }
});
```

### T2. `coarsen.test.ts:79` — asserts constants equal their own literals

```ts
expect(CELL_SIZE_M).toBe(1000);
expect(BUFFER_M).toBe(50);
```

Restates the source file. Cannot fail for any reason a reviewer would care about. Delete.

### T3. `coarsen.test.ts:60` — the "within BUFFER_M" test never reaches the hysteresis branch

Both probe points (x=1970 and x=1990) are inside cell 1, so `coarsenProjected` returns via the
`rawCell === currentCell` early return; the `overshoot >= BUFFER_M` comparison never executes.
Verified. Row 6 of the spec table test already covers the real case (in cell 2, probing 1980).
Delete, or rewrite to start in the *neighbouring* cell so the branch actually runs.

### T4. `coarsen.test.ts:68` — projection round-trip is a tautology

`unprojectFromMeters(projectToMeters(lat, lng), lat)` is the algebraic inverse evaluated at the same
`refLat`; it cannot fail. `precision-algorithm-spec.md` §4 explicitly says the projection "is standard
and not itself under test", and `coarsen.ts:50` repeats that. Delete. (Note the irony: had this test
used the *cell centre* latitude as `refLat`, it would have caught C1.)

### T5. `coarsen.test.ts:55` — `distanceToCellRect` rows 3 and 4 are already covered

Rows 3 and 4 of the seven-row table test exercise exactly these two values through the public
function. This duplicates them against an internal helper that is only exported to enable it. Delete
the test and un-export the helper (see D8).

### T6. `ratchet.test.ts:16` — "advance is one-way" does not test one-wayness

```ts
expect(advanceRatchet(state0).key).toEqual(state1.key);   // determinism
expect(state1.key).not.toEqual(state0.key);               // inequality
```

Neither assertion has anything to do with irreversibility, and the comment concedes it: "there is no
inverse of advanceRatchet to walk state1 back to state0" is an assertion in prose, not in code. One-way-ness
is a property of HKDF-SHA256 and is not testable here. Either rename to what it checks ("advance is
deterministic and moves off the current key") or delete it — but do not leave a test claiming a
security property it never exercises.

### T7. `ratchet.test.ts:37` and `room-key.test.ts:50` — vacuous inequality assertions

`expect(reset.key).not.toEqual(advanceRatchetKeyOf(state1))` and "generates independent keys across
epochs" (`expect(first).not.toEqual(second)` on two 32-byte RNG draws) both assert that random values
differ. They fail with probability 2⁻²⁵⁶ — i.e. they test the RNG's existence, not this code. Delete.
Note `room-key.test.ts:50` also sits inside `describe.each(AEADS)` while ignoring `aead`, so it runs
twice for no reason.

### T8. `encoding.test.ts:22` — "deterministic and round-trips through equal input"

Calls a pure function twice with the same array and compares. Tautology. Delete.

### T9. `encoding.test.ts:28` pins a bug in place

The "lowercases string fields so case cannot smuggle extra distinctness" test locks in C2. Its
rationale is also backwards: distinctness between distinct identifiers is the *goal* of an AAD, not
smuggling. Delete alongside the `.toLowerCase()` call.

### T10. `ratchet.test.ts:57` — a hoisted one-line helper used once

`advanceRatchetKeyOf` wraps `advanceRatchet(state).key` and is declared *below* its use, relying on
function hoisting inside a `describe`. Inline it — or delete it with T7, which is its only caller.

### T11. `padding.test.ts:6` — 255 iterations where three would do

Exhaustively pads every length 0…254. Nothing varies across iterations except the length already
covered by the boundaries; 0, 1, and `MAX_FIX_PAYLOAD_LENGTH` prove the same thing. Low priority — it
is fast and harmless — but it reads as coverage theatre. Also `new Uint8Array(length).map((_, i) => i % 256)`
has a redundant `% 256`: `length` never exceeds 254.

---

## X — Comments to remove or rewrite

Per `AGENTS.md`: comments must explain *why*, not restate the code.

- **`coarsen.ts:50-51`** — "Pure meter-space cell/hysteresis logic — the projection wrapping this is
  standard and not itself under test (spec §4)." Keep the clause citing the spec, but it is currently
  load-bearing cover for the untested projection wrapper that contains C1. Once T1 exists, trim to the
  spec citation alone.
- **`aead/types.ts:7`** — "Returns nonce || ciphertext || tag; draws its own nonce from `random`."
  **Keep.** The wire layout of the returned buffer is not inferable from the signature and every
  `open` implementation depends on it. This is a genuine why-comment.
- **`encoding.ts:15-16`** — the length-prefix rationale. **Keep**, it explains a real decision. But it
  documents only the length-prefixing and says nothing about the `.toLowerCase()` on the very next
  line — the one behaviour a reader would never predict. If C2 is somehow kept, that needs the comment
  far more than the prefixing does.
- **`ratchet.ts:19-20`** — "`generation` is the caller's running count across epoch bumps and manual
  resets (0 at room creation); this function only derives the seed for that generation." **Keep**, but
  it is currently describing behaviour that is misleading (C4) — the function does *not* derive per
  generation. Update it when C4 is fixed.
- **`aes-gcm.test.ts:8-9`, `chacha20-poly1305.test.ts:7-8`** — both explain why the KAT sits outside
  the parameterized suite. **Keep**; that is exactly a why-comment.
- **`ratchet.test.ts:23`** — "…but there is no inverse of advanceRatchet to walk state1 back to
  state0." Delete with T6. A comment asserting an untested security property is worse than silence.
- **`room-key.ts`** — `wrapKeySalt` orders fields `deviceId, roomId, epoch` while `wrapAad` orders them
  `roomId, epoch, deviceId`. This looks like a copy-paste slip and is **not** — it is exactly what
  `key-management-spec.md` §2 mandates. It needs a one-line comment saying so, or the next person to
  "tidy up the inconsistency" silently breaks interop with every envelope already written. This is the
  single highest-value comment to *add* in the PR.

---

## Not issues — checked, do not file

Recorded so the next reviewer doesn't re-litigate them.

- **X25519 low-order points.** `@noble/curves` rejects them: `scalarMult` with an all-zero peer key
  throws "invalid private or public key received". No contributory-behaviour check needed.
- **RFC known-answer tests for HKDF and X25519** (`kdf.test.ts`, `identity.test.ts:8`) look like
  testing a third-party library, but both pin *argument order* — `hkdf(ikm, salt, info)` and
  `scalarMult(secret, public)` are trivially transposable and would fail silently in a way nothing
  else catches. Keep them.
- **No key zeroization** anywhere. Correct call: JS cannot reliably wipe memory (GC copies, immutable
  string interning), so an explicit wipe would be false assurance. Not worth filing.
- **Unauthenticated envelope wrapping** — anyone who knows a device's public key can mint an envelope;
  `wrapRoomKey` uses an ephemeral sender key with no sender authentication. This is spec-level, not a
  code defect: `key-management-spec.md` §3 explicitly accepts it ("It cannot verify that an issuer
  wrapped correctly to the *right* recipients — that trust boundary is … membership + role checks
  enforced in the app layer"). Raise against the spec if you disagree; do not fix it here.
- **Padding does not randomize filler bytes.** Filler is zeros, but the padded block is sealed under an
  AEAD, so there is no attacker-visible malleability. Fine.
- **`unpadFixPlaintext` DataView aliasing.** It correctly passes `byteOffset`/`byteLength`, so it works
  on subarray views. Checked specifically because it is an easy bug to write; this one is right.

---

## Suggested order of work

1. **C1** — privacy bug, defeats the package's stated purpose. Fix with T1 in the same commit.
2. **C2**, **C3** — cross-author key collision and a device-freezing DoS. Both small fixes.
3. **C4**, **C5** — latent footguns.
4. **D1–D7** — mechanical, all verified behaviour-preserving. Land as one deletion commit.
5. **T1–T11**, **X** — test and comment cleanup.
6. **C6**, **C7**, **D8** — robustness and API surface.

Per `AGENTS.md`, follow TDD: for C1, C2 and C3 write the failing test first — each is
straightforwardly expressible, and for C1 the missing test *is* the finding.
