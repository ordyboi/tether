# Phase 6 — Client shell, identity, join

Issue: [#11 Phase 6: client shell, identity, join](https://github.com/ordyboi/tether/issues/11)

## Context

The server is done through phase 5: rooms, epochs, envelopes, invites and better-auth all
work and are tested (`apps/server`). `@tether/crypto` and `@tether/api` are complete and
test-covered. The mobile app is still the Expo starter — three files, one placeholder screen,
no theme, no auth, no networking.

Phase 6 gives the app a body: a sign-in screen, a design system extracted from the Cupertino
row of the **Tether Room Flows** canvas, and enough of the room UI to prove the hard part —
that two physical devices can sign in, exchange an invite link, unwrap the room key and end up
in the same room at the same epoch.

The map itself is phase 8 and room creation is phase 9, so the room screen ships with a
coloured placeholder where the map will go and the room is created headlessly. What this phase
is really testing is identity, key exchange and join, with just enough UI to drive it by hand.

The Cupertino artboards are the design source, but they are prototypes and they disagree with
each other — two secondary text colours, five heading sizes for three roles, gutters of 14/16/20
on screens that sit next to each other. Part of the work is resolving those into one scale
before any of it becomes code.

## Scope

**In**

| | |
|---|---|
| Sign-in screen | Not in the artboards. Built from the same tokens. Apple, Google, passkey, plus anonymous. |
| Room screen | `CupRoom` — placeholder box for the map, floating buttons, collapsed bottom bar. Includes the `CupNewRoom` one-member empty state. |
| Share sheet | `CupShare` — QR, link, copy, expiry warning. How device 1 invites device 2. |
| Join screen | Not in the artboards. Deep-link target that looks up, unwraps and redeems an invite. |
| `theme.ts` + `components/` | Tokens and primitives, alignment conflicts resolved. |
| Backend gaps | Invite `id` on lookup, `memberCount` on room summary, Expo auth transport. |

**Out** — room creation wizard (`CupName`/`CupPolicy`/`CupInvite`), rooms dashboard (`Main`),
expanded member-list sheet (`CupRoomSheet`), member detail (`CupMember`), real map, any fix
upload or read, precision requests.

## Two blocking backend gaps

Both must land or the two-device test cannot pass.

**1. `POST /invites/lookup` doesn't return the invite id.** `unwrapRoomKeyForInvite`
(`packages/crypto/src/invite.ts:38`) puts `inviteId` in the AAD, but
`inviteLookupResponseSchema` (`packages/api/src/responses.ts`) returns only `roomId`,
`grantsRole`, `wrappedRoomKey`, `wrappedRoomKeyEpoch`, `expiresAt`. Device 2 cannot build the
AAD, so it cannot decrypt the room key. Add `id: z.uuid()` to the schema and to the handler's
return in `apps/server/src/routes/invites.ts` — the row is already loaded. This leaks nothing:
the caller already holds the raw token and gets the wrapped key.

**2. Nothing reports how many people are in a room.** `GET /rooms` returns only the caller's own
membership row; `GET /rooms/:roomId/devices` returns device ids and public keys, no aliases.
The collapsed bar needs a count — and that count going 1 → 2 is the readback that proves the
join worked. Add `memberCount: z.int().positive()` to `roomSummarySchema` and a count subquery
over active `membership` rows in the `GET /rooms` handler (`apps/server/src/routes/rooms.ts:45`).

Deliberately **not** adding a members-list endpoint. The expanded sheet is out of scope, and
aliases plus display-name ciphertexts are a bigger surface than a count.

## Design system

Extract from the Cupertino artboards into `apps/mobile/src/theme.ts`, with primitives in
`apps/mobile/src/components/`. The artboards conflict; these are the resolutions.

### Colour

| Token | Value | Resolves |
|---|---|---|
| `text.primary` | `#16171A` | consistent already |
| `text.secondary` | `#43464F` | was `#43464F` (Main, CupName, CupPolicy, CupInvite) vs `#8A8A8E` (Main2, CupShare, sheets). Body copy takes the AA-contrast one. |
| `text.tertiary` | `#8A8A8E` | the other one, demoted to metadata and timestamps only |
| `accent` | `#0A84FF` | consistent |
| `accent.tint` | `rgba(10,132,255,0.12)` | kills the `#0A84FF1A` / `#7B6CE01A` hex-alpha forms (0.10, not 0.12) |
| `bg.app` | `#F2F1F6` | |
| `bg.surface` | `#FFFFFF` | |
| `bg.fill` | `rgba(120,120,128,0.12)` | pills, tiles |
| `bg.fillSubtle` | `rgba(120,120,128,0.08)` | grouped list background |
| `separator` | `rgba(60,60,67,0.13)` | one colour; width is always `StyleSheet.hairlineWidth`, never the literal `0.5px`/`1px`/`1.5px` mix |
| `warning.bg` | `rgba(255,204,0,0.14)` | was this vs `#FFE68224` on the same banner in `CupInvite` |
| `success` | `#2E7D4F` | live/recent |
| `avatar[]` | `#2E6FE8 #B85A32 #4A6B45 #1F5FD0 #2FA98C` | ad-hoc in the artboards; pick deterministically by hashing `memberAlias` |
| `avatar.stale` | `#9AA0A6` | |

Drop the one-off `#1E2430` CTA (`CupMember`, out of scope). The `stroke: 16` on `Main`'s
settings gear is invalid CSS — do not carry it across.

### Type

Thirteen sizes across the artboards (34, 32, 30, 28, 27, 18, 16.5, 16, 15, 13.5, 13, 12.5, 11,
10, 9.5) collapse to seven roles:

| Role | Size / weight / tracking | Resolves |
|---|---|---|
| `largeTitle` | 34 / 700 / -0.03em | was 32 (`Main`) vs 34 (`Main2`) |
| `title` | 28 / 700 / -0.03em | was 30 (sheets), 28 (steps), 27 (member); also fixes weight 400 (`CupName`, `CupPolicy`, `CupInvite`) vs 700 (`CupShare`) on the same role |
| `headline` | 17 / 600 / -0.01em | row titles were 18 / 16.5 / 16 |
| `body` | 16 / 400 | |
| `subhead` | 15 / 400 | |
| `footnote` | 13 / 400 | was 13 / 13.5 / 12.5 |
| `caption` | 11 / 600 / 0.08em uppercase | was 11 / 10 / 9.5 |

Avatar initials use a `avatarFont(size) => Math.round(size * 0.42)` helper rather than the
baked fractional literals (`17.64`, `18.48`, `15.12`, `26.04`).

### Spacing, radii, sizing

- **Spacing scale** `4 8 12 16 20 24 32`. Replaces the ad-hoc 9/10/11/13/14 gaps.
- **Screen gutter 16** everywhere. The artboards use 16 for headers and 20 for content on the
  same screen (`CupName`, `CupPolicy`, `CupInvite`, `CupShare`), so the back chevron sits 4px
  off the heading below it; sheets then use 20 for the header and 14 for the list. One gutter.
- **Bottom inset** `useSafeAreaInsets().bottom + 16`, not the hardcoded 20 / 26 / 30.
- **Radii** `sm 8`, `md 12`, `lg 14`, `xl 20`, `pill 999`, `full`. Buttons were 12 and 16 on
  adjacent screens → `lg 14`. Cards 14. Sheet top 22 → `xl 20`. Icon tiles 11/10 → `md 12`.
  Copy chip 9 → `sm 8`.
- **Borders** 1 for cards and fields, `hairlineWidth` for dividers. The 1.5 variants go.
- **Touch targets** floating map buttons 46 → **44** (iOS minimum, and matches the 44 avatar
  and list-icon sizes already in use).

### Primitives

`apps/mobile/src/components/` — `Button` (primary / secondary / plain), `Card`, `ListRow`,
`Avatar` + `AvatarStack`, `Sheet`, `Pill`, `Banner`, `Text` (role prop off the type scale),
`Icon`. Each gets a colocated `*.test.tsx`.

## Screens

All under `apps/mobile/src/app/`, expo-router, `typedRoutes` is already on.

```
_layout.tsx          root Stack, session gate, deep-link config
index.tsx            resolve: no session → /sign-in; session → room, else create one → /room/[roomId]
sign-in.tsx
room/[roomId].tsx
room/[roomId]/share.tsx    presentation: "modal"
join/[token].tsx           deep-link target
```

**`sign-in.tsx`** — `largeTitle` "Tether", `body` subtitle, four actions: Apple, Google,
Passkey, and a plain "Continue without an account". Footnote reuses the artboard copy: *"Room
names and the names of people in them are encrypted on your phone. We can't read them."*

**`room/[roomId].tsx`** — full-bleed `bg.fill` placeholder box where the map lands in phase 8,
labelled so it reads as intentional. Floating back and recentre buttons at 44px, safe-area top
+ 8, gutter 16. Collapsed bottom bar: pill, safe inset + 16, gutter 16, avatar stack, room name
at `headline`, member count at `footnote`/`text.tertiary`. The artboard puts an 18/700 title
over a 16/500 subtitle — the largest type conflict in the set; the subtitle must drop to 13.
Only your own avatar renders in the stack this phase; the rest arrive with the member list.
Tapping the recentre slot opens Share (the map has nothing to recentre yet).

**`room/[roomId]/share.tsx`** — modal. Title 28/700, subtitle at `body`/`text.secondary` (was
15/`#8A8A8E` here and 16/`#43464F` on the identical `CupInvite` block). QR at 160 (up from the
artboard's 138, for error-correction headroom at arm's length) via `react-native-qrcode-svg`.
Link row at `body`, copy chip radius 8 / border 1. Warning banner on the single `warning.bg`
token. Close X top-right, "Done" at the foot.

**`join/[token].tsx`** — states: resolving → confirm ("Join <room>?") → joining → success →
error (expired, already redeemed, already a member). Success routes to `/room/[roomId]`.

## Backend and wiring

**Auth transport.** better-auth is cookie-based; React Native's fetch won't carry that.
Add `@better-auth/expo@1.7.2` (matches the installed `better-auth@1.7.2`):

- Server: `expo()` in the plugins array of `apps/server/src/auth/auth.ts`, and `tether://` in
  `TRUSTED_ORIGINS`.
- Client: `expoClient({ scheme: "tether", storage: SecureStore })`. Apple and Google go through
  `signIn.social({ provider, callbackURL })` and the plugin handles the browser round trip and
  deep-link return.
- `@tether/api`'s existing `headers()` hook (`packages/api/src/client/index.ts:47`) returns
  `{ Cookie: authClient.getCookie() }`, so every `/rooms`, `/devices` and `/invites` call is
  authenticated by the same session. No new client plumbing needed.
- Do **not** set a custom `User-Agent` — the no-IP/no-UA invariant.

**App scheme.** `apps/mobile/app.json` `scheme` is `"mobile"`; change to `"tether"`.

**Env.** `EXPO_PUBLIC_API_URL` in the root `.env.example`, read through a new
`apps/mobile/src/env.ts` zod validator, matching how `apps/server/src/env.ts` does it.

**Identity.** `apps/mobile/src/identity/` — on first run generate an X25519 keypair with
`generateIdentityKeyPair()` from `@tether/crypto`, store the private key in `expo-secure-store`
(never exported, per the threat model), register with `createDevice({ identityPublicKey,
platform })`. Cache the returned `deviceId`.

**Room auto-create.** `index.tsx`: `listRooms()`; if empty, generate a room key, encrypt the
name `"Home"` and your display name, wrap the key to your own device with `wrapRoomKey()`, and
`createRoom({ nameCiphertext, displayNameCiphertext, precisionPolicy: "on_request",
approximateRadiusM: 500, envelopes })`. Policy is fixed at creation and no screen exposes it —
that invariant holds by construction here.

**Invite create** (Share): random `inviteSecret`, token = random bytes, `tokenHash` =
SHA-256 hex of the token, `wrapRoomKeyForInvite(aead, inviteSecret, roomKey, { roomId, epoch,
inviteId })`. The inviteId is only known after the row exists, so mint the uuid client-side and
pass it as the invite's id, or create then wrap-and-patch — prefer client-minted, it's one
round trip. Link: `tether://join/<token>#<base64url(inviteSecret)>`.

**Invite redeem** (Join): parse the fragment locally, `lookupInvite({ token })`,
`unwrapRoomKeyForInvite()` with the id from gap 1 above, then mint the next epoch's key, wrap
it to every device from `listRoomDevices()`, and `redeemInvite({ token, displayNameCiphertext,
expectedEpoch, nameCiphertext, envelopes })`. On `stale_epoch`, re-fetch devices and retry once.

**Fragment safety.** The fragment must never leave the device. Add a test asserting the string
after `#` appears in no request URL, body or header — the invariant calls this out explicitly.
Note that `expo-router`'s param parsing does not reliably preserve fragments; read the raw URL
via `Linking.useURL()` and split it yourself rather than trusting `useLocalSearchParams`.

## Subagent split

Two agents, as you suggested. They collide on the room screen, so fix the seam first.

**Before either starts:** write `apps/mobile/src/data/` — `useSession`, `useRoom`, `useInvite`,
`useJoin` — with final signatures and stub bodies returning fixture data. That file is the
contract. Agent A codes against the stubs; agent B replaces the bodies. Neither edits the
other's side.

**Agent A — flow and design system.** `theme.ts`, `components/`, the four screens, the
alignment resolutions above, component and screen tests. Never touches `src/auth`, `src/data`
internals, `src/identity`, `packages/`, or `apps/server`.

**Agent B — backend and wiring.** The two server gaps, `@better-auth/expo` on both ends, scheme
change, `env.ts`, identity + secure store, device registration, room auto-create, invite
create/redeem crypto, deep linking, and filling in `src/data`. Never touches `theme.ts`,
`components/`, or screen JSX.

Then one integration pass on a device: unstub, run the two-device flow, fix what breaks.

## Verification

Per AGENTS.md: tests first, then implementation; `format`, `lint`, `test` before every commit.

- `packages/api`, `apps/server` — vitest. New cases: invite lookup returns `id`; `GET /rooms`
  returns `memberCount`; the fragment-never-transmitted assertion.
- `apps/mobile` — jest-expo + `@testing-library/react-native`. Component tests per primitive;
  screen tests for sign-in (each provider fires the right call), room (empty vs joined member
  count), share (link shape, copy), join (all five states).
- Local stack: `docker compose up`, `npm run db:push -w apps/server`, `npm run dev -w apps/server`.
  Never generate migrations.
- **Two-device acceptance, by hand.** Both devices need a dev build (`@better-auth/expo` and
  the passkey native module are not Expo Go compatible). Device 1: sign in → lands in an
  auto-created room, bar reads "1 member". Open Share, scan the QR from device 2. Device 2: sign
  in, redeem, land in the same room. Device 1's bar goes to "2 members" and both report the same
  `currentEpoch`. Confirm device 2's key came from the invite unwrap, not a server-held secret.
- You'll need to run the device build and the two-device pass yourself — I can't drive a
  connected device from here.

## Known limitations

- **Passkey on device is the risky one.** better-auth's passkey plugin is WebAuthn, so native
  needs `react-native-passkey` plus associated domains — an
  `apple-app-site-association` served over HTTPS from `PASSKEY_RP_ID`. That can't be satisfied
  against `localhost`. Expect Apple, Google and anonymous to work on device before passkey does;
  keep the passkey button wired but treat a failure there as environmental, not a code bug.
- The avatar stack shows only you until the member list lands.
- No location anywhere: no fixes, no last-seen, no precision. The bar's member count is the
  only live data on the room screen.

## Branch and handoff

Branch `feat/11-client-shell-identity-join` off latest `main`. Commit this document as
`PLAN.md` at the repo root, conventional commit (`docs: add phase 6 implementation plan`), push
to origin. No PR unless asked. A later session deletes `PLAN.md` when the phase closes, as
`6990b51` did for the last one.
