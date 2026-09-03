# Rekey churn

Measured by `apps/server/src/rooms/rekey.load.test.ts`, which drives one epoch bump through
`POST /invites/redeem` over `app.inject` against real Postgres (Node.js, single test-suite
process, `npm test -w server`). Wrapping uses `@tether/crypto`'s real X25519 wrap + HKDF derive
on the test-runner machine, not a mobile device.

Churn is one envelope written per active device per epoch bump — this is `N` below.

| Scale | N (devices) | Client wrap (all N, parallel) | Server (route + transaction) | Total |
|---|---:|---:|---:|---:|
| Household | 6 | ~30ms | ~20–28ms | ~52–60ms |
| 10× household | 60 | ~195–215ms | ~17–21ms | ~215–230ms |

Three runs each; figures above are the observed range, not a single sample. The server-only
share barely moves between 6 and 60 devices — every envelope for a bump is written in one
batched `insert(...).values([...])`, not a per-device loop — so wall clock at this scale is
dominated by the client wrap step, which is `O(N)` by construction (one X25519 + HKDF per
recipient).

## On-device wrap cost

Per-device wrap cost measured on-device (Pixel 7, GrapheneOS Android 17, n=102): p50 ≈53ms,
p95 ≈77ms, worst observed ≈391ms. That is far higher than this test's Node.js wrap timings
(~5ms/device here vs ~53ms/device on-device) — expected, since the mobile figure includes
Android Keystore-backed key operations this test environment does not have.

Extrapolating the on-device per-device figure to the scales above:

| Scale | N | p50 estimate (N × 53ms) | p95 estimate (N × 77ms) | Worst-case estimate (N × 391ms) |
|---|---:|---:|---:|---:|
| Household | 6 | ~320ms | ~460ms | ~2.3s |
| 10× household | 60 | ~3.2s | ~4.6s | ~23.5s |

The server-side cost measured in this file (tens of milliseconds, flat across scale) is
negligible next to the on-device wrap cost at either scale — rekey churn latency is a
client-side concern, not a server one. At 10x household scale the worst-case on-device estimate
(~23.5s) is the number to design guest-join UX around: a background job with progress feedback,
not a blocking spinner on the invite screen.
