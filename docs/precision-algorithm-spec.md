# Approximate precision algorithm spec

Phase 1b. Answers the open question in PRD §11: "How approximate? Neighbourhood-level,
fixed-radius, or grid-snapped?" — and its follow-on, that grid-snapping needs hysteresis or a
member standing near a cell boundary flickers between cells and leaks their true position via
the flicker pattern itself.

**Decision: fixed-size grid-snapping with a sticky buffer band.** Grid-snapping was chosen over
neighbourhood-level (no stable, geometry-independent definition of "neighbourhood" worldwide)
and plain fixed-radius-around-precise-point (reveals the true point is at the center, which a
repeated-observation attacker can average out — a grid cell reveals only "somewhere in this
square," which stays true no matter how many times it's observed, as long as the true point
doesn't move cells).

This runs **on the author's device, before upload**, for every fix in every room where
`precisionPolicy = 'approximate_only'` or `'on_request'`. Under `approximate_only` this coarse
point is the *only* location value ever computed or sealed — the precise fix never exists past
the OS location callback. Under `on_request` it runs in addition to the precise seal. Under
`always_precise` it does not run at all (no `approximateCiphertext` distinct from precise —
see the key management spec §7 for how `always_precise` seals only the one value).

## 1. Parameters

| Name | Value | Rationale |
|---|---|---|
| `CELL_SIZE_M` | 1000 | `2 × approximateRadiusM` (500m default), giving a ~1km² area — coarse enough that a residential block or two sits inside one cell, fine enough to still answer "which side of town." |
| `BUFFER_M` | 50 | Well above GPS's typical 5–20m outdoor noise floor (PRD §11), and small relative to `CELL_SIZE_M` so the buffer band doesn't itself dominate the cell. |

Both are implementation constants, not per-room configuration — `room.approximateRadiusM`
exists in the schema for future flexibility, but nothing in the product surfaces it as a
setting (consistent with the precision-policy-is-immutable-and-hidden invariant; the radius
rides along with the policy, not exposed separately).

## 2. Projection

Grid cells are defined in local meters, not raw lat/lng degrees, so cell size stays roughly
constant regardless of latitude. Standard equirectangular approximation, evaluated at the
fix's own latitude (adequate at this precision — sub-percent error over a ~1km cell; no need
for anything more sophisticated):

```
function projectToMeters(lat, lng):
    x = lng * 111_320 * cos(lat * π / 180)
    y = lat * 110_540
    return (x, y)

function unprojectFromMeters(x, y, refLat):
    lat = y / 110_540
    lng = x / (111_320 * cos(refLat * π / 180))
    return (lat, lng)
```

`refLat` for unprojection is the cell's own center latitude (self-consistent — the projection
and its inverse use the same lat for the `cos` term, since a 1km cell's latitude span is too
small for that choice to matter).

## 3. Coarsening with hysteresis

State is per `(deviceId, roomId)`, held only on the author's device — nothing server-side needs
to know about it, since the server never sees precise coordinates under `approximate_only` and
under `on_request` it only ever receives whatever this function outputs for the approximate
column.

```
STATE per (deviceId, roomId): currentCellX, currentCellY   -- unset until first fix

function cellCenter(cellX, cellY):
    cx = (cellX + 0.5) * CELL_SIZE_M
    cy = (cellY + 0.5) * CELL_SIZE_M
    return (cx, cy)

function distanceToCellRect(x, y, cellX, cellY):
    -- 0 if (x, y) is inside the cell's rectangle, else Euclidean distance
    -- to the nearest point on that rectangle
    xMin, xMax = cellX * CELL_SIZE_M, (cellX + 1) * CELL_SIZE_M
    yMin, yMax = cellY * CELL_SIZE_M, (cellY + 1) * CELL_SIZE_M
    dx = max(xMin - x, 0, x - xMax)
    dy = max(yMin - y, 0, y - yMax)
    return sqrt(dx*dx + dy*dy)

function coarsen(lat, lng, state):
    (x, y) = projectToMeters(lat, lng)
    rawCellX = floor(x / CELL_SIZE_M)
    rawCellY = floor(y / CELL_SIZE_M)

    if state.currentCellX is unset:
        state.currentCellX, state.currentCellY = rawCellX, rawCellY
        (cx, cy) = cellCenter(rawCellX, rawCellY)
        return unprojectFromMeters(cx, cy, lat)

    if (rawCellX, rawCellY) == (state.currentCellX, state.currentCellY):
        (cx, cy) = cellCenter(state.currentCellX, state.currentCellY)
        return unprojectFromMeters(cx, cy, lat)

    -- point has left the currently-displayed cell: only switch if it has
    -- moved solidly past the boundary, not just noise across the line
    overshoot = distanceToCellRect(x, y, state.currentCellX, state.currentCellY)

    if overshoot >= BUFFER_M:
        state.currentCellX, state.currentCellY = rawCellX, rawCellY

    (cx, cy) = cellCenter(state.currentCellX, state.currentCellY)
    return unprojectFromMeters(cx, cy, lat)
```

### Why this defeats boundary flicker

The switch condition is checked against the **old** cell's boundary, not the new cell's — so
after switching, the same logic in reverse requires the point to travel `BUFFER_M` back past
the (now-current) new cell's boundary before switching back. The result is a symmetric sticky
band of width `BUFFER_M` straddling every cell edge: a point oscillating within that band,
which is exactly what GPS noise at a real boundary looks like, never triggers a second switch.
The displayed cell only changes when the person's actual, sustained position has moved into a
new cell — which is the coarsening's job to reveal — not when noise nudges them across a line.

A large jump (app cold-start far from the last known cell, e.g. after a flight) always exceeds
`BUFFER_M` and switches immediately — hysteresis only suppresses small, boundary-adjacent
moves, never legitimate relocation.

## 4. Test vectors

Given in local projected meters directly (the lat/lng ⇄ meters projection in §2 is standard
and not itself under test). `CELL_SIZE_M = 1000`, `BUFFER_M = 50`. State starts unset.

| # | Input (x, y) | Raw cell | Old state | Overshoot vs old cell | New state | Output center |
|---|---|---|---|---|---|---|
| 1 | (1200, 800) | (1, 0) | unset | — (first fix) | (1, 0) | (1500, 500) |
| 2 | (1450, 900) | (1, 0) | (1, 0) | same cell | (1, 0) | (1500, 500) |
| 3 | (2010, 900) | (2, 0) | (1, 0) | 10 (< 50) | (1, 0) | (1500, 500) |
| 4 | (2060, 900) | (2, 0) | (1, 0) | 60 (≥ 50) | (2, 0) | (2500, 500) |
| 5 | (2005, 900) | (2, 0) | (2, 0) | same cell | (2, 0) | (2500, 500) |
| 6 | (1980, 900) | (1, 0) | (2, 0) | 20 (< 50) | (2, 0) | (2500, 500) |
| 7 | (50000, 50000) | (50, 50) | (2, 0) | ≫ 50 (large jump) | (50, 50) | (50500, 50500) |

Row 3 and row 5/6 together demonstrate the flicker case directly: a point sitting within 50m of
the boundary on either side, in either direction, never changes the displayed cell once one has
been established — rows 3 and 6 both fall inside the sticky band on opposite sides of the
`x=2000` edge and both hold their prior cell. Row 4 shows the same edge crossed solidly (60m
overshoot) and does switch. Row 7 shows an unrelated large jump is not suppressed by hysteresis.

`distanceToCellRect` worked for row 3: cell (1,0) spans x∈[1000,2000), y∈[0,1000). Point
(2010, 900): `dx = max(1000-2010, 0, 2010-2000) = max(-1010, 0, 10) = 10`; `dy = max(0-900, 0,
900-1000) = max(-900, 0, -100) = 0`. `overshoot = sqrt(10² + 0²) = 10`.

Row 4: point (2060, 900) against the same old cell (1,0): `dx = max(-1060, 0, 60) = 60`, `dy =
0`, `overshoot = 60`.

These seven rows are the minimum set an implementer should assert in Phase 2's test suite for
the coarsening function; additional randomized/property-based tests (e.g. "cell never changes
for any two points within `BUFFER_M` of each other on the same side of a boundary") are
recommended but not enumerated here.
