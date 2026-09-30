import { describe, expect, it } from "vitest";
import type { Point } from "../contour";
import { parseIcon } from "../parse/parse-icon";
import { FA_SOLID_HEART } from "../parse/test-fixtures";
import { findBestRotation, rotationCost } from "./align-rotation";
import { sampleEvenly } from "./arc-length";
import { matchContours } from "./match-contours";
import { collapsedPartner } from "./placeholder";
import { sharedPointCount } from "./reconcile-density";
import {
  FA_REGULAR_HEART,
  mulberry32,
  randomPolygon,
  rectangle,
  rotatePoints,
} from "./test-helpers";

describe("rotatePoints (test helper)", () => {
  it("moves index (i + k) mod N to index i", () => {
    const points = rectangle(0, 0, 1, 1);
    expect(rotatePoints(points, 1)).toEqual([points[1], points[2], points[3], points[0]]);
    expect(rotatePoints(points, 0)).toEqual(points);
  });
});

describe("rotationCost", () => {
  it("sums the Euclidean distance of each index pair at the given offset", () => {
    const from = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ];
    const to = [
      { x: 0, y: 4 },
      { x: 3, y: 0 },
    ];
    expect(rotationCost(from, to, 0)).toBe(4);
    expect(rotationCost(from, to, 1)).toBe(3 + 5);
  });
});

describe("findBestRotation", () => {
  it("recovers a known rotation exactly on evenly spaced samples (property, 200 random polygons)", () => {
    const random = mulberry32(21);
    for (let run = 0; run < 200; run++) {
      const polygon = randomPolygon(random, 3 + Math.floor(random() * 80), { x: 50, y: 50 });
      const count = sharedPointCount(polygon.length, polygon.length);
      const points = sampleEvenly(polygon, count);
      const offset = Math.floor(random() * count);
      // `to` is the same outline sampled from `offset` samples later, so pairing from[i] with
      // to[i + k] is exact when k = N − offset.
      const to = rotatePoints(points, offset);
      const expected = (count - offset) % count;
      expect(findBestRotation(points, to)).toBe(expected);
      expect(rotationCost(points, to, expected)).toBe(0);
    }
  });

  it("finds the arc-length shift of a contour started at another vertex, to within one sample", () => {
    const random = mulberry32(24);
    for (let run = 0; run < 100; run++) {
      const polygon = randomPolygon(random, 10 + Math.floor(random() * 70), { x: 50, y: 50 });
      const start = 1 + Math.floor(random() * (polygon.length - 1));
      const restarted = rotatePoints(polygon, start);
      const count = sharedPointCount(polygon.length, restarted.length);
      const offset = findBestRotation(sampleEvenly(polygon, count), sampleEvenly(restarted, count));

      // `restarted` begins `startFraction` of the way round `polygon`, so `polygon`'s fraction s
      // is `restarted`'s s − startFraction: the ideal shift is 1 − startFraction.
      let walked = 0;
      let total = 0;
      for (const [index, a] of polygon.entries()) {
        const b = polygon[(index + 1) % polygon.length] as Point;
        if (index < start) walked += Math.hypot(b.x - a.x, b.y - a.y);
        total += Math.hypot(b.x - a.x, b.y - a.y);
      }
      const ideal = 1 - walked / total;
      const gap = Math.abs(offset / count - ideal);
      expect(Math.min(gap, 1 - gap)).toBeLessThanOrEqual(1 / count);
    }
  });

  it("recovers a known rotation under noise and a small shift", () => {
    const random = mulberry32(22);
    const points = randomPolygon(random, 60, { x: 50, y: 50 });
    const to = rotatePoints(
      points.map((p) => ({ x: p.x + 0.5 + random() * 0.1, y: p.y - 0.3 + random() * 0.1 })),
      17,
    );
    expect(findBestRotation(points, to)).toBe(60 - 17);
  });

  it("resolves a placeholder partner to k = 0, on either side", () => {
    const random = mulberry32(23);
    for (let run = 0; run < 50; run++) {
      const polygon = randomPolygon(random, 3 + Math.floor(random() * 80), { x: 50, y: 50 });
      const count = sharedPointCount(polygon.length, polygon.length);
      const points = sampleEvenly(polygon, count);
      const placeholder = sampleEvenly(collapsedPartner(polygon), count);
      expect(findBestRotation(points, placeholder)).toBe(0);
      expect(findBestRotation(placeholder, points)).toBe(0);
    }
  });

  it("gives equal-cost offsets to the smallest k", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    // k = 1 and k = 3 both cost 0; k = 0 and k = 2 cost 40.
    expect(findBestRotation([a, b, a, b], [b, a, b, a])).toBe(1);
    // Every offset costs the same: k = 0.
    const square = rectangle(0, 0, 10, 10);
    const center: Point[] = square.map(() => ({ x: 5, y: 5 }));
    expect(findBestRotation(square, center)).toBe(0);
  });

  it("aligns FA Regular heart → FA Solid heart: non-zero offset, far less travel than k = 0", () => {
    // Spec 04's acceptance criterion, re-pinned for spec 07's evenly spaced samples. Spec 02
    // starts the regular heart's outline at its right lobe's top and the solid heart's at its
    // left lobe's, so k = 0 pairs them half a shape apart.
    const from = parseIcon(FA_REGULAR_HEART).contours;
    const to = parseIcon(FA_SOLID_HEART).contours;
    const [outer] = matchContours(from, to).matched;
    if (outer === undefined) throw new Error("expected the two outer outlines to match");
    expect(outer.from.isHole || outer.to.isHole).toBe(false);

    const count = sharedPointCount(outer.from.points.length, outer.to.points.length);
    const fromPoints = sampleEvenly(outer.from.points, count);
    const toPoints = sampleEvenly(outer.to.points, count);
    const offset = findBestRotation(fromPoints, toPoints);
    const naiveCost = rotationCost(fromPoints, toPoints, 0);
    const alignedCost = rotationCost(fromPoints, toPoints, offset);

    // Recorded in progress-tracker.md: N = 82, k = 68, 3718.88 → 44.93 canonical units. (Spec
    // 04's vertex-keeping samples gave k = 66, 4241.98 → 100.14.)
    expect(count).toBe(82);
    expect(offset).toBe(68);
    expect(naiveCost).toBeCloseTo(3718.88, 1);
    expect(alignedCost).toBeCloseTo(44.93, 1);
    expect(offset).not.toBe(0);
    expect(alignedCost).toBeLessThan(naiveCost / 10);
  });
});
