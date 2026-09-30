import { describe, expect, it } from "vitest";
import type { Contour, Point } from "../contour";
import { rectangle } from "../morph/test-helpers";
import { visibleRate } from "./visible-rate";

/** A regular 64-gon outline around (50, 50), counter-clockwise on screen, starting at the top. */
function circle(radius: number, center: Point = { x: 50, y: 50 }): Contour[] {
  const points = Array.from({ length: 64 }, (_, index) => {
    const angle = -Math.PI / 2 - (index / 64) * Math.PI * 2;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
  return [{ id: "c0", parentId: null, isHole: false, depth: 0, points }];
}

describe("visibleRate", () => {
  it("measures growth in full: a circle growing by 10 moves its outline 10 per unit of progress", () => {
    expect(visibleRate(circle(20), circle(30), 0.5)).toBeCloseTo(10, 6);
  });

  it("counts only a translation's across-the-outline part: d/√2 around a circle", () => {
    const rate = visibleRate(circle(20), circle(20, { x: 70, y: 50 }), 0.3);
    expect(rate).toBeCloseTo(20 / Math.SQRT2, 2);
  });

  it("is the same for a square moved in any direction: |d|/√2", () => {
    const square = (x: number, y: number): Contour[] => [
      { id: "c0", parentId: null, isHole: false, depth: 0, points: rectangle(x, y, 10, 10) },
    ];
    expect(visibleRate(square(0, 0), square(30, 40), 0)).toBeCloseTo(50 / Math.SQRT2, 6);
    expect(visibleRate(square(0, 0), square(50, 0), 0.7)).toBeCloseTo(50 / Math.SQRT2, 6);
  });

  it("is 0 for a leg that doesn't change the shape, and when nothing is drawn", () => {
    expect(visibleRate(circle(20), circle(20), 0.4)).toBeCloseTo(0, 6);
    const dot: Contour[] = [
      { id: "c0", parentId: null, isHole: false, depth: 0, points: [{ x: 1, y: 1 }] },
    ];
    expect(visibleRate(dot, dot, 0)).toBe(0);
  });
});
