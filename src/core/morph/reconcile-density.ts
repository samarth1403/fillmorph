import type { Point } from "../contour";

/**
 * Fewest points a matched pair is resampled to. Spec 02's adaptive flattening can leave a
 * straight-edged contour with only a handful of points; morphing that into a curve needs more
 * points on it than its own corners.
 */
export const MIN_SHARED_POINT_COUNT = 16;

/**
 * Most points a matched pair is resampled to. Well above any committed fixture (the largest
 * parsed contour has 87 points), so in practice it only caps pathological inputs. It bounds the
 * O(N²) rotation search that follows (deliverable #4).
 */
export const MAX_SHARED_POINT_COUNT = 1024;

/**
 * The point count both contours of a matched pair are resampled to (spec 04 deliverable #3):
 * whichever side has more detail, clamped to `MIN_SHARED_POINT_COUNT`…`MAX_SHARED_POINT_COUNT`.
 */
export function sharedPointCount(fromCount: number, toCount: number): number {
  return Math.min(MAX_SHARED_POINT_COUNT, Math.max(MIN_SHARED_POINT_COUNT, fromCount, toCount));
}

/**
 * Resamples a closed polygon (closing edge implicit) to exactly `count` points, starting at the
 * same point.
 *
 * - **Adding points** (the usual case) keeps every original vertex, in order and at its position,
 *   and inserts the extra points evenly along the edges, sharing them out in proportion to edge
 *   length. The outline is unchanged, so an icon's corners stay sharp and a morph's end frames
 *   are exactly the parsed icon.
 * - **Same count** returns a copy.
 * - **Removing points** (only above `MAX_SHARED_POINT_COUNT`) samples `count` points evenly by
 *   arc length. That can cut corners, which is accepted for a contour that detailed.
 *
 * A zero-length polygon (every point the same, e.g. deliverable #2's placeholder) has no edge
 * lengths to go by, so extra points are shared out evenly by edge instead. Expects `count ≥ 1`
 * and at least one point.
 */
export function resamplePolygon(points: readonly Point[], count: number): Point[] {
  if (count === points.length) return points.map((point) => ({ ...point }));
  return count > points.length ? insertPoints(points, count) : sampleByArcLength(points, count);
}

function edgeLengths(points: readonly Point[]): number[] {
  return points.map((a, index) => {
    const b = points[(index + 1) % points.length] as Point;
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
}

function insertPoints(points: readonly Point[], count: number): Point[] {
  const lengths = edgeLengths(points);
  const perEdge = shareOut(count - points.length, lengths);
  const result: Point[] = [];
  for (const [index, a] of points.entries()) {
    const b = points[(index + 1) % points.length] as Point;
    const inserted = perEdge[index] as number;
    result.push({ ...a });
    for (let step = 1; step <= inserted; step++) {
      const t = step / (inserted + 1);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

/**
 * Splits `extra` points between edges in proportion to their length, by the largest-remainder
 * method: whole shares first, then the leftover points to the largest fractional shares (lower
 * edge index on ties). All-zero lengths share out evenly instead.
 */
function shareOut(extra: number, lengths: readonly number[]): number[] {
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const weights = total > 0 ? lengths : lengths.map(() => 1);
  const weightTotal = total > 0 ? total : lengths.length;
  const exact = weights.map((weight) => (extra * weight) / weightTotal);
  const shares = exact.map(Math.floor);
  let leftover = extra - shares.reduce((sum, share) => sum + share, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (leftover === 0) break;
    shares[index] = (shares[index] as number) + 1;
    leftover--;
  }
  return shares;
}

function sampleByArcLength(points: readonly Point[], count: number): Point[] {
  const lengths = edgeLengths(points);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return points.slice(0, count).map((point) => ({ ...point }));

  const result: Point[] = [];
  let edge = 0;
  let edgeStart = 0;
  for (let index = 0; index < count; index++) {
    const target = (index * total) / count;
    while (edgeStart + (lengths[edge] as number) < target && edge < points.length - 1) {
      edgeStart += lengths[edge] as number;
      edge++;
    }
    const a = points[edge] as Point;
    const b = points[(edge + 1) % points.length] as Point;
    const length = lengths[edge] as number;
    const t = length === 0 ? 0 : (target - edgeStart) / length;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}
