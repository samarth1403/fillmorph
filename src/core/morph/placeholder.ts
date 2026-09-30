import type { Point } from "../contour";
import { centroidOf } from "./centroid";

/**
 * The synthesized partner for a contour with no real one (spec 04 deliverable #2): a degenerate
 * contour with as many points as `points`, every one at `points`' own area centroid.
 *
 * Paired with the real contour, it makes the contour collapse to a point (as the `to` side) or
 * grow from one (as the `from` side). Interpolating each point straight toward one point is a
 * uniform scale plus a shift, so the contour keeps its shape and winding while it shrinks, and
 * can't self-intersect on the way unless it already did.
 *
 * The own centroid is the fallback collapse point, used when the contour has no ancestor with a
 * partner. Otherwise `interpolate` swaps in the live centroid of the nearest such ancestor at each
 * progress value. Expects at least one point.
 */
export function collapsedPartner(points: readonly Point[]): Point[] {
  const centroid = centroidOf(points);
  return points.map(() => ({ x: centroid.x, y: centroid.y }));
}
