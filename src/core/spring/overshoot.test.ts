import { describe, expect, it } from "vitest";
import type { Contour } from "../contour";
import { rectangle } from "../morph/test-helpers";
import { OVERSHOOT_SCALE, popContours } from "./overshoot";

/** A 60 × 60 square at (20, 20) with a 20 × 20 hole in its middle. */
const RING: Contour[] = [
  { id: "c0", parentId: null, isHole: false, depth: 0, points: rectangle(20, 20, 60, 60) },
  { id: "c1", parentId: "c0", isHole: true, depth: 1, points: rectangle(40, 40, 20, 20).reverse() },
];

function signedArea(contour: Contour): number {
  let twice = 0;
  for (const [index, point] of contour.points.entries()) {
    const next = contour.points[(index + 1) % contour.points.length] as { x: number; y: number };
    twice += point.x * next.y - next.x * point.y;
  }
  return twice / 2;
}

describe("popContours", () => {
  it("returns the target itself at position 1", () => {
    expect(popContours(RING, 1)).toBe(RING);
  });

  it("scales every contour uniformly about the bounding box's center by the overshoot", () => {
    const popped = popContours(RING, 1.5);
    const scale = 1 + OVERSHOOT_SCALE * 0.5;
    for (const [index, contour] of popped.entries()) {
      const source = RING[index] as Contour;
      expect({ ...contour, points: [] }).toEqual({ ...source, points: [] });
      for (const [pointIndex, point] of contour.points.entries()) {
        const original = source.points[pointIndex] as { x: number; y: number };
        expect(point.x).toBeCloseTo(50 + (original.x - 50) * scale, 12);
        expect(point.y).toBeCloseTo(50 + (original.y - 50) * scale, 12);
      }
    }
  });

  it("keeps the hole inside its parent and the same way round, however far it overshoots", () => {
    for (const position of [1.01, 1.3, 2, 4]) {
      const [outer, hole] = popContours(RING, position) as [Contour, Contour];
      const xs = (contour: Contour) => contour.points.map((point) => point.x);
      expect(Math.min(...xs(hole))).toBeGreaterThan(Math.min(...xs(outer)));
      expect(Math.max(...xs(hole))).toBeLessThan(Math.max(...xs(outer)));
      expect(Math.sign(signedArea(hole))).toBe(Math.sign(signedArea(RING[1] as Contour)));
    }
  });

  it("does not mutate the target", () => {
    const copy = JSON.parse(JSON.stringify(RING));
    popContours(RING, 1.3);
    expect(RING).toEqual(copy);
  });
});
