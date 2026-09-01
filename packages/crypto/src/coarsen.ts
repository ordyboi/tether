export const CELL_SIZE_M = 1000;
export const BUFFER_M = 50;

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
}

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export function projectToMeters(lat: number, lng: number): ProjectedPoint {
  const x = lng * 111_320 * Math.cos((lat * Math.PI) / 180);
  const y = lat * 110_540;
  return { x, y };
}

export function unprojectFromMeters(x: number, y: number, refLat: number): LatLng {
  const lat = y / 110_540;
  const lng = x / (111_320 * Math.cos((refLat * Math.PI) / 180));
  return { lat, lng };
}

export interface CoarsenState {
  readonly currentCellX: number;
  readonly currentCellY: number;
}

function cellCenter(cellX: number, cellY: number): ProjectedPoint {
  return { x: (cellX + 0.5) * CELL_SIZE_M, y: (cellY + 0.5) * CELL_SIZE_M };
}

function distanceToCellRect(x: number, y: number, cellX: number, cellY: number): number {
  const xMin = cellX * CELL_SIZE_M;
  const xMax = (cellX + 1) * CELL_SIZE_M;
  const yMin = cellY * CELL_SIZE_M;
  const yMax = (cellY + 1) * CELL_SIZE_M;
  const dx = Math.max(xMin - x, 0, x - xMax);
  const dy = Math.max(yMin - y, 0, y - yMax);
  return Math.sqrt(dx * dx + dy * dy);
}

export interface CoarsenProjectedResult {
  readonly state: CoarsenState;
  readonly center: ProjectedPoint;
}

// Pure meter-space cell/hysteresis logic (spec §4).
export function coarsenProjected(
  x: number,
  y: number,
  state: CoarsenState | null,
): CoarsenProjectedResult {
  const rawCellX = Math.floor(x / CELL_SIZE_M);
  const rawCellY = Math.floor(y / CELL_SIZE_M);

  if (state === null) {
    const nextState = { currentCellX: rawCellX, currentCellY: rawCellY };
    return { state: nextState, center: cellCenter(rawCellX, rawCellY) };
  }

  if (rawCellX === state.currentCellX && rawCellY === state.currentCellY) {
    return { state, center: cellCenter(state.currentCellX, state.currentCellY) };
  }

  const overshoot = distanceToCellRect(x, y, state.currentCellX, state.currentCellY);
  const nextState =
    overshoot >= BUFFER_M ? { currentCellX: rawCellX, currentCellY: rawCellY } : state;
  return { state: nextState, center: cellCenter(nextState.currentCellX, nextState.currentCellY) };
}

export interface CoarsenResult {
  readonly state: CoarsenState;
  readonly point: LatLng;
}

// Callers pass real GPS fixes, which are never polar; antimeridian wrapping
// is likewise not built, since neither is a plausible input for this product.
export function coarsen(lat: number, lng: number, state: CoarsenState | null): CoarsenResult {
  if (Math.abs(lat) >= 90) {
    throw new Error("coarsen does not support polar latitudes");
  }
  const { x, y } = projectToMeters(lat, lng);
  const { state: nextState, center } = coarsenProjected(x, y, state);
  // Unproject at the cell centre's own latitude, not the fix's — using the
  // true latitude here would make the reported longitude a continuous
  // function of the real position, leaking it through repeated observation.
  const centerLat = center.y / 110_540;
  return { state: nextState, point: unprojectFromMeters(center.x, center.y, centerLat) };
}
