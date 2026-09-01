import { describe, expect, it } from "vitest";

import { type CoarsenState, coarsen, coarsenProjected } from "./coarsen.js";

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

  it("every point inside one cell coarsens to the same point", () => {
    const first = coarsen(40.71, -74.006, null);
    let state = first.state;

    for (let i = 1; i <= 10; i++) {
      const result = coarsen(40.71 + (i * 50) / 110_540, -74.006, state);
      if (
        result.state.currentCellX !== first.state.currentCellX ||
        result.state.currentCellY !== first.state.currentCellY
      ) {
        break;
      }
      state = result.state;
      expect(result.point).toEqual(first.point);
    }
  });
});
