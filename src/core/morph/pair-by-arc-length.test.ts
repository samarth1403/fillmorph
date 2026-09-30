import { describe, expect, it } from "vitest";
import type { Contour, Point } from "../contour";
import { distanceToOutline, distanceToSegment } from "../parse/geometry";
import { parseIcon } from "../parse/parse-icon";
import { FA_SOLID_CIRCLE, FA_SOLID_HEART } from "../parse/test-fixtures";
import { findBestRotation } from "./align-rotation";
import { centroidOf } from "./centroid";
import { matchContours } from "./match-contours";
import { pairByArcLength } from "./pair-by-arc-length";
import { collapsedPartner } from "./placeholder";
import { sharedPointCount } from "./reconcile-density";
import {
  FA_REGULAR_HEART,
  FA_SOLID_B,
  mulberry32,
  randomPolygon,
  rectangle,
  rotatePoints,
} from "./test-helpers";

type Pairing = { fromPoints: Point[]; toPoints: Point[] };

/** `point`'s arc-length fraction around `polygon`, for a point on its outline. */
function fractionOf(point: Point, polygon: readonly Point[]): number {
  let walked = 0;
  let found: number | null = null;
  for (const [index, a] of polygon.entries()) {
    const b = polygon[(index + 1) % polygon.length] as Point;
    if (found === null && distanceToSegment(point, a, b) < 1e-9) {
      found = walked + Math.hypot(point.x - a.x, point.y - a.y);
    }
    walked += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (found === null) throw new Error("point is not on the outline");
  return found / walked;
}

/** Whether `vertices` appear in `points`, exactly and in cyclic order. */
function containsInOrder(points: readonly Point[], vertices: readonly Point[]): boolean {
  const start = points.findIndex((p) => p.x === vertices[0]?.x && p.y === vertices[0]?.y);
  if (start === -1) return false;
  let cursor = 0;
  for (let step = 0; step < points.length && cursor < vertices.length; step++) {
    const point = points[(start + step) % points.length] as Point;
    const vertex = vertices[cursor] as Point;
    if (point.x === vertex.x && point.y === vertex.y) cursor++;
  }
  return cursor === vertices.length;
}

describe("pairByArcLength", () => {
  it("adds a point on one side where the other has a vertex, at the same arc-length fraction", () => {
    // The same square, but `to` has an extra vertex halfway down its first edge (fraction 1/8).
    const from = rectangle(0, 0, 10, 10);
    const to = [{ x: 0, y: 0 }, { x: 0, y: 5 }, ...rectangle(0, 0, 10, 10).slice(1)];
    expect(pairByArcLength(from, to)).toEqual({
      fromPoints: [{ x: 0, y: 0 }, { x: 0, y: 5 }, ...from.slice(1)],
      toPoints: to,
    });
  });

  it("pairs a contour with itself point for point, adding nothing", () => {
    const random = mulberry32(41);
    const points = randomPolygon(random, 40, { x: 50, y: 50 });
    expect(pairByArcLength(points, points)).toEqual({ fromPoints: points, toPoints: points });
  });

  it("merges positions that differ only by rounding, including across the wrap back to point 0", () => {
    // A regular 16-gon restarted at vertex j: the search's shift is exactly j/16 (sharedPointCount
    // is 16), while `to`'s vertex fractions are sums of float edge lengths, a few ulps off j/16.
    // Some land just below the shift, i.e. just below 1 once shifted: those must merge into point
    // 0, not add a 17th point on top of it.
    for (const radius of [7, 13, 29.3]) {
      const polygon = Array.from({ length: 16 }, (_, index) => {
        const angle = -(index / 16) * Math.PI * 2 + 0.3;
        return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
      });
      for (let start = 1; start < 16; start++) {
        const { fromPoints, toPoints } = pairByArcLength(polygon, rotatePoints(polygon, start));
        expect(fromPoints).toHaveLength(16);
        toPoints.forEach((point, index) => {
          const partner = fromPoints[index] as Point;
          expect(Math.hypot(point.x - partner.x, point.y - partner.y)).toBeLessThan(1e-9);
        });
      }
    }
  });

  it("keeps both sides' vertices exactly, puts every other point on its outline, and pairs equal fractions (property, 200 random pairs)", () => {
    const random = mulberry32(42);
    for (let run = 0; run < 200; run++) {
      const from = randomPolygon(random, 3 + Math.floor(random() * 60), { x: 50, y: 50 });
      const to = randomPolygon(random, 3 + Math.floor(random() * 60), {
        x: 40 + random() * 20,
        y: 40 + random() * 20,
      });
      const { fromPoints, toPoints } = pairByArcLength(from, to);
      expect(toPoints).toHaveLength(fromPoints.length);
      expect(fromPoints[0]).toEqual(from[0]);
      expect(containsInOrder(fromPoints, from)).toBe(true);
      expect(containsInOrder(toPoints, to)).toBe(true);
      for (const point of fromPoints) expect(distanceToOutline(point, from)).toBeLessThan(1e-9);
      for (const point of toPoints) expect(distanceToOutline(point, to)).toBeLessThan(1e-9);

      // Paired points sit at fractions one fixed shift apart: arc-length pairing, not by index.
      const shifts = fromPoints.map((point, index) => {
        const shift = fractionOf(toPoints[index] as Point, to) - fractionOf(point, from);
        return shift - Math.floor(shift);
      });
      const first = shifts[0] as number;
      for (const shift of shifts) {
        const gap = Math.abs(shift - first);
        expect(Math.min(gap, 1 - gap)).toBeLessThan(1e-9);
      }
      // Fractions only ever move forward around `from`.
      const fractions = fromPoints.map((point) => fractionOf(point, from));
      for (let index = 1; index < fractions.length; index++) {
        expect(fractions[index]).toBeGreaterThan(fractions[index - 1] as number);
      }
    }
  });

  it("takes a placeholder's points from its partner's vertices, on either side", () => {
    const random = mulberry32(43);
    const shape = randomPolygon(random, 30, { x: 50, y: 50 });
    const placeholder = collapsedPartner(shape);
    const center = placeholder[0] as Point;

    const growing = pairByArcLength(placeholder, shape);
    expect(growing.toPoints).toEqual(shape);
    expect(growing.fromPoints).toEqual(shape.map(() => center));

    const collapsing = pairByArcLength(shape, placeholder);
    expect(collapsing.fromPoints).toEqual(shape);
    expect(collapsing.toPoints).toEqual(shape.map(() => center));
  });

  it("gives one point when both sides have zero length", () => {
    expect(
      pairByArcLength(
        [
          { x: 1, y: 2 },
          { x: 1, y: 2 },
        ],
        [{ x: 5, y: 5 }],
      ),
    ).toEqual({
      fromPoints: [{ x: 1, y: 2 }],
      toPoints: [{ x: 5, y: 5 }],
    });
  });
});

/**
 * Spec 04's index pairing, reproduced as the baseline spec 07 must beat: the smaller side gains
 * points on its edges (shared out by edge length, every vertex kept), both sides reach the shared
 * count, the rotation search runs on those arrays, and point i pairs with point i.
 */
function indexPairing(from: readonly Point[], to: readonly Point[]): Pairing {
  const count = sharedPointCount(from.length, to.length);
  const fromPoints = insertPoints(from, count);
  const toPoints = insertPoints(to, count);
  return { fromPoints, toPoints: rotatePoints(toPoints, findBestRotation(fromPoints, toPoints)) };
}

function insertPoints(points: readonly Point[], count: number): Point[] {
  const lengths = points.map((a, index) => {
    const b = points[(index + 1) % points.length] as Point;
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const extra = count - points.length;
  const exact = lengths.map((length) => (extra * length) / total);
  const shares = exact.map(Math.floor);
  const leftover = extra - shares.reduce((sum, share) => sum + share, 0);
  exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, leftover)
    .forEach(({ index }) => {
      shares[index] = (shares[index] as number) + 1;
    });
  return points.flatMap((a, index) => {
    const b = points[(index + 1) % points.length] as Point;
    const inserted = shares[index] as number;
    return Array.from({ length: inserted + 1 }, (_, step) => {
      const t = step / (inserted + 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
  });
}

/** Distance from `center` to the farthest crossing of `polygon`'s outline by the ray at `angle`. */
function radiusAt(polygon: readonly Point[], center: Point, angle: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let radius = 0;
  for (const [index, a] of polygon.entries()) {
    const b = polygon[(index + 1) % polygon.length] as Point;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const wx = a.x - center.x;
    const wy = a.y - center.y;
    const along = (wx * ey - wy * ex) / denominator;
    const onEdge = (wx * dy - wy * dx) / denominator;
    if (along >= 0 && onEdge >= 0 && onEdge <= 1) radius = Math.max(radius, along);
  }
  return radius;
}

/**
 * How far a pairing's halfway frame strays from a smooth, pairing-independent halfway shape: the
 * radial average of the two outlines. Around the midpoint of the two area centroids, at each of
 * 720 ray angles, the reference radius is the mean of `from`'s and `to`'s radii, and the error is
 * how far the halfway frame's radius is from it. For star-shaped outlines (every fixture compared
 * below) that reference is a smooth blend of the two shapes, and it involves no point pairing at
 * all, so it favors neither method. Facets show up as the halfway frame cutting straight across
 * where the reference curves.
 */
function radialError(pairing: Pairing, from: readonly Point[], to: readonly Point[]) {
  const halfway = pairing.fromPoints.map((a, index) => {
    const b = pairing.toPoints[index] as Point;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  });
  const fromCenter = centroidOf(from);
  const toCenter = centroidOf(to);
  const center = { x: (fromCenter.x + toCenter.x) / 2, y: (fromCenter.y + toCenter.y) / 2 };
  const errors = Array.from({ length: 720 }, (_, step) => {
    const angle = (step / 720) * Math.PI * 2;
    const reference = (radiusAt(from, center, angle) + radiusAt(to, center, angle)) / 2;
    return Math.abs(radiusAt(halfway, center, angle) - reference);
  });
  return {
    max: Math.max(...errors),
    mean: errors.reduce((sum, error) => sum + error, 0) / errors.length,
  };
}

function outerPair(fromSvg: string, toSvg: string): { from: Contour; to: Contour } {
  const [outer] = matchContours(parseIcon(fromSvg).contours, parseIcon(toSvg).contours).matched;
  if (outer === undefined) throw new Error("expected the outer outlines to match");
  return outer;
}

describe("faceting on structurally different outlines (spec 07 acceptance)", () => {
  // Measured when spec 07 landed (canonical units, halfway frame, max / mean):
  // - solid heart → solid circle: index 2.58 / 0.95, arc-length 1.20 / 0.31;
  // - solid B → solid circle: index 6.81 / 1.79, arc-length 0.76 / 0.26;
  // - solid heart → solid B: index 11.28 / 3.41, arc-length 4.12 / 0.99.
  it.each([
    ["solid heart → solid circle", FA_SOLID_HEART, FA_SOLID_CIRCLE],
    ["solid B → solid circle", FA_SOLID_B, FA_SOLID_CIRCLE],
    ["solid heart → solid B", FA_SOLID_HEART, FA_SOLID_B],
  ])("%s: the halfway frame is far closer to the smooth radial blend", (_, fromSvg, toSvg) => {
    const { from, to } = outerPair(fromSvg, toSvg);
    const before = radialError(indexPairing(from.points, to.points), from.points, to.points);
    const after = radialError(pairByArcLength(from.points, to.points), from.points, to.points);
    expect(after.mean).toBeLessThan(before.mean / 2);
    expect(after.max).toBeLessThan(before.max / 2);
  });

  it("keeps a re-posed outline (Regular → Solid heart) within a fifth of a unit of the blend", () => {
    // Index pairing already did well here (max 0.04). Arc-length pairing measured max 0.14, mean
    // 0.002: 0.2 units is a fifth of a pixel at 100px, so no visible change.
    const { from, to } = outerPair(FA_REGULAR_HEART, FA_SOLID_HEART);
    const after = radialError(pairByArcLength(from.points, to.points), from.points, to.points);
    expect(after.max).toBeLessThan(0.2);
    expect(after.mean).toBeLessThan(0.01);
  });
});
