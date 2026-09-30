import { describe, expect, it } from "vitest";
import { centroidOf } from "./centroid";
import { mulberry32, randomPolygon, rectangle } from "./test-helpers";

describe("centroidOf", () => {
  it("returns the center of a rectangle", () => {
    expect(centroidOf(rectangle(10, 20, 30, 40))).toEqual({ x: 25, y: 40 });
  });

  it("weights by area, not by where the vertices are dense", () => {
    // A square with extra points crowded along its left edge: the vertex mean drifts left, the
    // area centroid doesn't.
    const square = [
      { x: 0, y: 0 },
      { x: 0, y: 2.5 },
      { x: 0, y: 5 },
      { x: 0, y: 7.5 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ];
    const centroid = centroidOf(square);
    expect(centroid.x).toBeCloseTo(5, 12);
    expect(centroid.y).toBeCloseTo(5, 12);
  });

  it("gives the same answer for either winding direction", () => {
    const points = rectangle(3, 4, 7, 2);
    expect(centroidOf([...points].reverse())).toEqual(centroidOf(points));
  });

  it("falls back to the vertex mean for a zero-area contour", () => {
    expect(
      centroidOf([
        { x: 4, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 4 },
      ]),
    ).toEqual({ x: 4, y: 4 });
    expect(
      centroidOf([
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 0 },
      ]),
    ).toEqual({ x: 3, y: 0 });
  });

  it("keeps the centroid of a nearly collapsed contour far from the origin", () => {
    const points = rectangle(80, 80, 1e-5, 1e-5);
    const centroid = centroidOf(points);
    expect(centroid.x).toBeCloseTo(80 + 5e-6, 10);
    expect(centroid.y).toBeCloseTo(80 + 5e-6, 10);
  });

  it("moves with a translation of the polygon (property, 200 random polygons)", () => {
    const random = mulberry32(4);
    for (let run = 0; run < 200; run++) {
      const points = randomPolygon(random, 3 + Math.floor(random() * 40), { x: 50, y: 50 });
      const shift = { x: random() * 20 - 10, y: random() * 20 - 10 };
      const before = centroidOf(points);
      const after = centroidOf(points.map((p) => ({ x: p.x + shift.x, y: p.y + shift.y })));
      expect(after.x).toBeCloseTo(before.x + shift.x, 9);
      expect(after.y).toBeCloseTo(before.y + shift.y, 9);
    }
  });
});
