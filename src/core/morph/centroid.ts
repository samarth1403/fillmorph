import type { Point } from "../contour";

/**
 * Area below which (relative to the squared bounding-box diagonal) a polygon is treated as
 * degenerate, and its centroid falls back to the mean of its vertices.
 */
const DEGENERATE_AREA_RATIO = 1e-12;

/**
 * The area centroid of a closed polygon (closing edge implicit). Area-weighted rather than a
 * vertex mean, so it doesn't drift toward wherever adaptive flattening put more points.
 *
 * A zero-area polygon, e.g. a contour already collapsed to a point by an earlier morph and fed
 * back in as `from`, has no area centroid; its vertex mean is returned instead. Expects at least
 * one point.
 */
export function centroidOf(points: readonly Point[]): Point {
  const origin = points[0] as Point;
  // Working relative to the first point keeps the cross products small, so a nearly collapsed
  // polygon far from (0, 0) doesn't lose its area to cancellation.
  let twiceArea = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index] as Point;
    const b = points[(index + 1) % points.length] as Point;
    const ax = a.x - origin.x;
    const ay = a.y - origin.y;
    const bx = b.x - origin.x;
    const by = b.y - origin.y;
    const cross = ax * by - bx * ay;
    twiceArea += cross;
    sumX += (ax + bx) * cross;
    sumY += (ay + by) * cross;
    minX = Math.min(minX, ax);
    minY = Math.min(minY, ay);
    maxX = Math.max(maxX, ax);
    maxY = Math.max(maxY, ay);
  }
  const diagonalSquared = (maxX - minX) ** 2 + (maxY - minY) ** 2;
  if (Math.abs(twiceArea / 2) <= diagonalSquared * DEGENERATE_AREA_RATIO) {
    return vertexMean(points);
  }
  return { x: origin.x + sumX / (3 * twiceArea), y: origin.y + sumY / (3 * twiceArea) };
}

function vertexMean(points: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}
