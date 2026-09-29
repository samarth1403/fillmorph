import { describe, expect, it } from "vitest";
import type { Point } from "../contour";
import { flattenSubpath, measureExtent } from "./flatten";
import { distanceToSegment } from "./geometry";
import { parsePathData } from "./path-data";

const flatten = (d: string, tolerance: number): Point[] => {
  const [subpath] = parsePathData(d);
  if (!subpath) throw new Error("fixture has no subpath");
  return flattenSubpath(subpath, tolerance);
};

const distanceToPolyline = (point: Point, polyline: readonly Point[]): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index++) {
    best = Math.min(
      best,
      distanceToSegment(point, polyline[index - 1] as Point, polyline[index] as Point),
    );
  }
  return best;
};

const cubicAt = (p: readonly Point[], t: number): Point => {
  const s = 1 - t;
  const [a, b, c, d] = p as [Point, Point, Point, Point];
  return {
    x: s * s * s * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t * t * t * d.x,
    y: s * s * s * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t * t * t * d.y,
  };
};

describe("flattenSubpath", () => {
  it("keeps straight segments as their exact end points, with no extra subdivision", () => {
    expect(flatten("M0 0 L10 0 L10 10 Z", 0.01)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it("keeps every point of a cubic's true curve within the tolerance of the polyline", () => {
    const controls = [
      { x: 0, y: 0 },
      { x: 30, y: 100 },
      { x: 70, y: -100 },
      { x: 100, y: 0 },
    ];
    const tolerance = 0.25;
    const polyline = flatten("M0 0 C30 100 70 -100 100 0", tolerance);
    for (let step = 0; step <= 1000; step++) {
      expect(distanceToPolyline(cubicAt(controls, step / 1000), polyline)).toBeLessThanOrEqual(
        tolerance,
      );
    }
  });

  it("gives tight curves more points than gentle ones at the same tolerance", () => {
    const gentle = flatten("M0 0 C33 2 66 2 100 0", 0.1);
    const tight = flatten("M0 0 C33 80 66 80 100 0", 0.1);
    expect(tight.length).toBeGreaterThan(gentle.length);
  });

  it("uses fewer points at a looser tolerance", () => {
    const d = "M0 0 C0 50 100 50 100 0";
    expect(flatten(d, 1).length).toBeLessThan(flatten(d, 0.01).length);
  });

  it("flattens a quadratic within tolerance of its true curve", () => {
    const tolerance = 0.1;
    const polyline = flatten("M0 0 Q50 100 100 0", tolerance);
    for (let step = 0; step <= 200; step++) {
      const t = step / 200;
      const point = { x: 100 * t, y: 2 * (1 - t) * t * 100 };
      expect(distanceToPolyline(point, polyline)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("places arc points on the ellipse and ends exactly at the arc's end point", () => {
    const tolerance = 0.05;
    const polyline = flatten("M0 50 A50 50 0 0 1 100 50", tolerance);
    expect(polyline[polyline.length - 1]).toEqual({ x: 100, y: 50 });
    for (const point of polyline) {
      // Cubic arc pieces deviate from the true circle by ~0.03% of the radius, plus flattening.
      expect(Math.abs(Math.hypot(point.x - 50, point.y - 50) - 50)).toBeLessThan(tolerance + 0.02);
      // Sweep flag 1 from (0, 50) to (100, 50) goes through the top (smaller y).
      expect(point.y).toBeLessThanOrEqual(50 + 1e-9);
    }
  });

  it("honours the large-arc and sweep flags", () => {
    const small = flatten("M0 0 A10 10 0 0 1 10 0", 0.01);
    const large = flatten("M0 0 A10 10 0 1 1 10 0", 0.01);
    const minY = (points: Point[]) => Math.min(...points.map((point) => point.y));
    // Centres sit at (5, ±√75); sweep 1 runs clockwise on screen, so both arcs pass over the top.
    expect(minY(small)).toBeCloseTo(Math.sqrt(75) - 10, 1);
    expect(minY(large)).toBeCloseTo(-10 - Math.sqrt(75), 1);
  });

  it("scales up radii that are too small to reach the end point", () => {
    const polyline = flatten("M0 0 A1 1 0 0 1 20 0", 0.01);
    const minY = Math.min(...polyline.map((point) => point.y));
    expect(minY).toBeCloseTo(-10, 2);
  });

  it("treats a zero-radius arc as a straight line", () => {
    expect(flatten("M0 0 A0 5 0 0 1 10 0", 0.01)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("rotates the ellipse by the x-axis rotation", () => {
    const polyline = flatten("M0 0 A20 5 90 0 1 0 40", 0.01);
    // Rotated 90°, the 20-unit radius lies along y, so this half-ellipse bulges 5 units in x.
    const maxX = Math.max(...polyline.map((point) => Math.abs(point.x)));
    expect(maxX).toBeCloseTo(5, 1);
  });
});

describe("measureExtent", () => {
  it("returns the larger side of the bounding box of end and control points", () => {
    expect(measureExtent(parsePathData("M0 0 C0 -20 50 -20 50 0 Z"))).toBe(50);
  });

  it("returns 1 for geometry with no size, so tolerances stay positive", () => {
    expect(measureExtent(parsePathData("M3 3 Z"))).toBe(1);
  });
});
