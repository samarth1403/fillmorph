import { describe, expect, it } from "vitest";
import type { Point } from "../contour";
import { distanceToOutline } from "../parse/geometry";
import {
  MAX_SHARED_POINT_COUNT,
  MIN_SHARED_POINT_COUNT,
  resamplePolygon,
  sharedPointCount,
} from "./reconcile-density";
import { mulberry32, randomPolygon, rectangle } from "./test-helpers";

describe("sharedPointCount", () => {
  it("takes whichever side has more points", () => {
    expect(sharedPointCount(40, 87)).toBe(87);
    expect(sharedPointCount(87, 40)).toBe(87);
  });

  it("clamps to the floor and the ceiling", () => {
    expect(sharedPointCount(4, 3)).toBe(MIN_SHARED_POINT_COUNT);
    expect(sharedPointCount(5000, 3)).toBe(MAX_SHARED_POINT_COUNT);
  });
});

describe("resamplePolygon", () => {
  it("returns an equal copy at the same count", () => {
    const points = rectangle(0, 0, 4, 4);
    const result = resamplePolygon(points, 4);
    expect(result).toEqual(points);
    expect(result[0]).not.toBe(points[0]);
  });

  it("keeps every original vertex, in order, and shares extra points by edge length", () => {
    // Edges of length 30, 10, 30, 10: 8 extra points split 3/1/3/1.
    const points = rectangle(0, 0, 10, 30);
    const result = resamplePolygon(points, 12);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 7.5 },
      { x: 0, y: 15 },
      { x: 0, y: 22.5 },
      { x: 0, y: 30 },
      { x: 5, y: 30 },
      { x: 10, y: 30 },
      { x: 10, y: 22.5 },
      { x: 10, y: 15 },
      { x: 10, y: 7.5 },
      { x: 10, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it("gives leftover points to the largest remainders, lower edge index on ties", () => {
    // Four equal edges, 2 extra points: exact share 0.5 each, so edges 0 and 1 get one.
    const result = resamplePolygon(rectangle(0, 0, 8, 8), 6);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 0, y: 8 },
      { x: 4, y: 8 },
      { x: 8, y: 8 },
      { x: 8, y: 0 },
    ]);
  });

  it("keeps a zero-length (placeholder) contour at its single point", () => {
    const placeholder = Array.from({ length: 5 }, () => ({ x: 3, y: 7 }));
    const result = resamplePolygon(placeholder, 16);
    expect(result).toHaveLength(16);
    for (const point of result) expect(point).toEqual({ x: 3, y: 7 });
  });

  it("samples evenly by arc length when it has to remove points", () => {
    const points = resamplePolygon(rectangle(0, 0, 10, 10), 40);
    const result = resamplePolygon(points, 8);
    const expected = [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 0, y: 10 },
      { x: 5, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 5 },
      { x: 10, y: 0 },
      { x: 5, y: 0 },
    ];
    expect(result).toHaveLength(expected.length);
    for (const [index, point] of expected.entries()) {
      expect(result[index]?.x).toBeCloseTo(point.x, 9);
      expect(result[index]?.y).toBeCloseTo(point.y, 9);
    }
  });

  it("adds points without changing the outline (property, 200 random polygons)", () => {
    const random = mulberry32(11);
    for (let run = 0; run < 200; run++) {
      const points = randomPolygon(random, 3 + Math.floor(random() * 60), { x: 50, y: 50 });
      const count = points.length + 1 + Math.floor(random() * 100);
      const result = resamplePolygon(points, count);
      expect(result).toHaveLength(count);
      expect(result[0]).toEqual(points[0]);

      // Every original vertex survives, in order; every added point lies on the outline.
      let cursor = 0;
      for (const point of result) {
        const original = points[cursor];
        if (original !== undefined && point.x === original.x && point.y === original.y) cursor++;
        else expect(distanceToOutline(point, points)).toBeLessThan(1e-9);
      }
      expect(cursor).toBe(points.length);
    }
  });

  it("removes points to exactly the requested count, all on the outline", () => {
    const random = mulberry32(12);
    for (let run = 0; run < 50; run++) {
      const points: Point[] = randomPolygon(random, 20 + Math.floor(random() * 60), {
        x: 50,
        y: 50,
      });
      const count = 3 + Math.floor(random() * (points.length - 3));
      const result = resamplePolygon(points, count);
      expect(result).toHaveLength(count);
      expect(result[0]).toEqual(points[0]);
      for (const point of result) expect(distanceToOutline(point, points)).toBeLessThan(1e-9);
    }
  });
});
