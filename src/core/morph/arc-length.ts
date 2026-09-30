import type { Point } from "../contour";

/**
 * A closed polygon (closing edge implicit) parameterized by arc-length fraction: 0 at `points[0]`,
 * rising to 1 back at `points[0]` after the closing edge.
 */
export type ArcLengthPath = {
  points: readonly Point[];
  /**
   * Each vertex's arc-length fraction, non-decreasing from 0. `null` for a zero-length polygon
   * (every point the same), which has no perimeter to measure fractions along.
   */
  fractions: number[] | null;
};

/** Measures `points` (at least one) for `pointAtFraction`. */
export function parameterize(points: readonly Point[]): ArcLengthPath {
  const cumulative: number[] = [];
  let total = 0;
  for (const [index, a] of points.entries()) {
    cumulative.push(total);
    const b = points[(index + 1) % points.length] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { points, fractions: total > 0 ? cumulative.map((length) => length / total) : null };
}

/**
 * The point at arc-length fraction `t` (in 0…1) along `path`'s outline. A fraction that is exactly
 * a vertex's gives that vertex exactly; a zero-length path gives its one point.
 */
export function pointAtFraction(path: ArcLengthPath, t: number): Point {
  const { points, fractions } = path;
  if (fractions === null) return { ...(points[0] as Point) };
  // Last vertex at or before t, so a run of equal fractions (a zero-length edge) resolves to the
  // vertex that starts the next real edge.
  let low = 0;
  let high = fractions.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((fractions[middle] as number) <= t) low = middle;
    else high = middle - 1;
  }
  const a = points[low] as Point;
  const b = points[(low + 1) % points.length] as Point;
  const start = fractions[low] as number;
  const end = low + 1 < fractions.length ? (fractions[low + 1] as number) : 1;
  if (t === start || end === start) return { ...a };
  const local = (t - start) / (end - start);
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

/**
 * `count` points evenly spaced by arc length around a closed polygon, the first at `points[0]`.
 * Corners that fall between samples are cut, so this is for measuring a shape (spec 07's rotation
 * search), not for drawing it. A zero-length polygon gives `count` copies of its one point.
 */
export function sampleEvenly(points: readonly Point[], count: number): Point[] {
  const path = parameterize(points);
  return Array.from({ length: count }, (_, index) => pointAtFraction(path, index / count));
}
