import type { Point } from "fillmorph";

/**
 * Relative tolerance for orientation tests: a cross product this small, relative to the segment
 * lengths involved, counts as collinear. It keeps floating-point noise on touching or collinear
 * segments from registering as a crossing.
 */
const ORIENTATION_EPSILON = 1e-10;

/** Unsigned shoelace area of a closed polygon (closing edge implicit). */
export function polygonArea(points: readonly Point[]): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index] as Point;
    const b = points[(index + 1) % points.length] as Point;
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}

function orientation(origin: Point, a: Point, b: Point): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function sign(value: number, tolerance: number): -1 | 0 | 1 {
  if (value > tolerance) return 1;
  if (value < -tolerance) return -1;
  return 0;
}

/**
 * Whether segments `a1`–`a2` and `b1`–`b2` properly cross: each one's endpoints lie strictly on
 * opposite sides of the other. Touching (an endpoint on the other segment), sharing an endpoint,
 * collinear overlap, and zero-length segments are not crossings.
 */
export function segmentsCross(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const lengthA = Math.hypot(a2.x - a1.x, a2.y - a1.y);
  const lengthB = Math.hypot(b2.x - b1.x, b2.y - b1.y);
  const tolerance = ORIENTATION_EPSILON * lengthA * lengthB;
  if (tolerance === 0) return false;
  const b1Side = sign(orientation(a1, a2, b1), tolerance);
  const b2Side = sign(orientation(a1, a2, b2), tolerance);
  const a1Side = sign(orientation(b1, b2, a1), tolerance);
  const a2Side = sign(orientation(b1, b2, a2), tolerance);
  return b1Side * b2Side === -1 && a1Side * a2Side === -1;
}

/** The point where two properly crossing segments meet (see `segmentsCross`). */
export function crossingPoint(a1: Point, a2: Point, b1: Point, b2: Point): Point {
  const denominator = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / denominator;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

/** Distance from `point` to the segment `a`–`b`. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * Whether `point` is inside the closed polygon or within `tolerance` of its outline. Being on
 * the outline counts as inside, so a shape touching its container isn't reported as escaping.
 */
export function isInsideOrOnPolygon(
  point: Point,
  polygon: readonly Point[],
  tolerance: number,
): boolean {
  let isInside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index] as Point;
    const b = polygon[previous] as Point;
    if (distanceToSegment(point, a, b) <= tolerance) return true;
    if (a.y > point.y !== b.y > point.y) {
      const crossingX = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (point.x < crossingX) isInside = !isInside;
    }
  }
  return isInside;
}

/** Formats a coordinate or measurement for a human-readable report. */
export function formatNumber(value: number, digits = 3): string {
  return String(Number(value.toFixed(digits)));
}
