import { describe, expect, it } from "vitest";

import {
  BUFFER_M,
  CELL_SIZE_M,
  type CoarsenState,
  coarsen,
  coarsenProjected,
  distanceToCellRect,
  projectToMeters,
  unprojectFromMeters,
} from "./coarsen.js";

describe("coarsen", () => {
  it("matches the seven-row spec table (§4), in meter space", () => {
    let state: CoarsenState | null = null;

    const steps: Array<{
      point: { x: number; y: number };
      expectedCell: [number, number];
      expectedCenter: { x: number; y: number };
    }> = [
      { point: { x: 1200, y: 800 }, expectedCell: [1, 0], expectedCenter: { x: 1500, y: 500 } },
      { point: { x: 1450, y: 900 }, expectedCell: [1, 0], expectedCenter: { x: 1500, y: 500 } },
      { point: { x: 2010, y: 900 }, expectedCell: [1, 0], expectedCenter: { x: 1500, y: 500 } },
      { point: { x: 2060, y: 900 }, expectedCell: [2, 0], expectedCenter: { x: 2500, y: 500 } },
      { point: { x: 2005, y: 900 }, expectedCell: [2, 0], expectedCenter: { x: 2500, y: 500 } },
      { point: { x: 1980, y: 900 }, expectedCell: [2, 0], expectedCenter: { x: 2500, y: 500 } },
      {
        point: { x: 50000, y: 50000 },
        expectedCell: [50, 50],
        expectedCenter: { x: 50500, y: 50500 },
      },
    ];

    for (const step of steps) {
      const result = coarsenProjected(step.point.x, step.point.y, state);
      state = result.state;

      expect([result.state.currentCellX, result.state.currentCellY]).toEqual(step.expectedCell);
      expect(result.center).toEqual(step.expectedCenter);
    }
  });

  it("the lat/lng wrapper is deterministic and stable for a repeated fix", () => {
    const { lat, lng } = unprojectFromMeters(1200, 800, 51.5);

    const first = coarsen(lat, lng, null);
    const second = coarsen(lat, lng, first.state);

    expect(second.state).toEqual(first.state);
    expect(second.point).toEqual(first.point);
  });

  it("computes distanceToCellRect for row 3 and row 4 of the spec table", () => {
    expect(distanceToCellRect(2010, 900, 1, 0)).toBeCloseTo(10, 9);
    expect(distanceToCellRect(2060, 900, 1, 0)).toBeCloseTo(60, 9);
  });

  it("never changes cell for two points within BUFFER_M of each other on the same side of a boundary", () => {
    // Both points sit inside cell (1, 0), within BUFFER_M of the x=2000 edge.
    const afterFirst = coarsenProjected(1970, 900, null);
    const afterSecond = coarsenProjected(1990, 900, afterFirst.state);

    expect(afterSecond.state).toEqual(afterFirst.state);
  });

  it("projection and unprojection round-trip for an arbitrary point", () => {
    const lat = 51.5;
    const lng = -0.12;

    const { x, y } = projectToMeters(lat, lng);
    const back = unprojectFromMeters(x, y, lat);

    expect(back.lat).toBeCloseTo(lat, 9);
    expect(back.lng).toBeCloseTo(lng, 9);
  });

  it("uses CELL_SIZE_M and BUFFER_M as documented constants", () => {
    expect(CELL_SIZE_M).toBe(1000);
    expect(BUFFER_M).toBe(50);
  });
});
