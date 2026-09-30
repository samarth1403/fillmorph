import { describe, expect, it } from "vitest";
import { distanceToOutline } from "../parse/geometry";
import { parameterize, pointAtFraction, sampleEvenly } from "./arc-length";
import { mulberry32, randomPolygon, rectangle } from "./test-helpers";

describe("parameterize", () => {
  it("gives each vertex its share of the perimeter walked so far, starting at 0", () => {
    // Edges of length 30, 10, 30, 10 out of 80.
    expect(parameterize(rectangle(0, 0, 10, 30)).fractions).toEqual([0, 0.375, 0.5, 0.875]);
  });

  it("has no fractions for a zero-length polygon", () => {
    expect(
      parameterize([
        { x: 3, y: 7 },
        { x: 3, y: 7 },
      ]).fractions,
    ).toBeNull();
  });
});

describe("pointAtFraction", () => {
  const path = parameterize(rectangle(0, 0, 10, 30));

  it("returns a vertex exactly at its own fraction", () => {
    expect(pointAtFraction(path, 0.375)).toEqual({ x: 0, y: 30 });
    expect(pointAtFraction(path, 0)).toEqual({ x: 0, y: 0 });
  });

  it("interpolates along the edge a fraction falls on, including the closing edge", () => {
    expect(pointAtFraction(path, 0.25)).toEqual({ x: 0, y: 20 });
    expect(pointAtFraction(path, 0.9375)).toEqual({ x: 5, y: 0 });
  });

  it("skips a zero-length edge", () => {
    const withRepeat = parameterize([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ]);
    const point = pointAtFraction(withRepeat, (10 + 5) / (10 + 10 + Math.hypot(10, 10)));
    expect(point.x).toBeCloseTo(5, 12);
    expect(point.y).toBeCloseTo(10, 12);
  });

  it("returns the single point of a zero-length polygon", () => {
    expect(pointAtFraction(parameterize([{ x: 3, y: 7 }]), 0.6)).toEqual({ x: 3, y: 7 });
  });
});

describe("sampleEvenly", () => {
  it("places points at equal arc-length steps from point 0", () => {
    expect(sampleEvenly(rectangle(0, 0, 10, 10), 8)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 0, y: 10 },
      { x: 5, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 5 },
      { x: 10, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it("gives `count` copies of a zero-length polygon's point", () => {
    const result = sampleEvenly([{ x: 3, y: 7 }], 5);
    expect(result).toHaveLength(5);
    for (const point of result) expect(point).toEqual({ x: 3, y: 7 });
  });

  it("puts every sample on the outline (property, 100 random polygons)", () => {
    const random = mulberry32(31);
    for (let run = 0; run < 100; run++) {
      const points = randomPolygon(random, 3 + Math.floor(random() * 60), { x: 50, y: 50 });
      const count = 3 + Math.floor(random() * 120);
      const result = sampleEvenly(points, count);
      expect(result).toHaveLength(count);
      expect(result[0]).toEqual(points[0]);
      for (const point of result) expect(distanceToOutline(point, points)).toBeLessThan(1e-9);
    }
  });
});
