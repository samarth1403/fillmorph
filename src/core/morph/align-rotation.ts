import type { Point } from "../contour";

/**
 * Two offsets whose costs differ by less than this, per point, in canonical units (out of 100)
 * count as tied. Far above floating-point summation noise, far below anything visible. Without
 * it, a placeholder partner's equal costs could differ in the last bit depending on summation
 * order, and a rotation other than k = 0 would win by accident.
 */
const TIE_TOLERANCE_PER_POINT = 1e-9;

/**
 * Total point travel when `from.points[i]` pairs with `to.points[(i + offset) mod N]`: the sum of
 * the Euclidean distances. Expects `from` and `to` to have the same length.
 */
export function rotationCost(from: readonly Point[], to: readonly Point[], offset: number): number {
  const count = from.length;
  let cost = 0;
  for (let index = 0; index < count; index++) {
    const a = from[index] as Point;
    const b = to[(index + offset) % count] as Point;
    cost += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return cost;
}

/**
 * The rotational offset k that minimizes `rotationCost` (spec 04 deliverable #4), searching every
 * k = 0 … N−1. Ties go to the smallest k, so equal-cost cases keep spec 02's start-point pairing
 * (k = 0); a placeholder partner, whose every offset costs the same, lands there with no special
 * case. Rotation only: direction is never reversed, since spec 02 already normalizes winding.
 *
 * O(N²). Expects `from` and `to` to have the same length (after deliverable #3).
 */
export function findBestRotation(from: readonly Point[], to: readonly Point[]): number {
  const tolerance = TIE_TOLERANCE_PER_POINT * from.length;
  let bestOffset = 0;
  let bestCost = rotationCost(from, to, 0);
  for (let offset = 1; offset < from.length; offset++) {
    const cost = rotationCost(from, to, offset);
    if (cost < bestCost - tolerance) {
      bestOffset = offset;
      bestCost = cost;
    }
  }
  return bestOffset;
}

/** `points` rotated so the result's index i is the input's index `(i + offset) mod N`. */
export function rotatePoints(points: readonly Point[], offset: number): Point[] {
  return [...points.slice(offset), ...points.slice(0, offset)];
}
