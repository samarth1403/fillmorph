import type { Point } from "../contour";
import { findBestRotation } from "./align-rotation";
import { parameterize, pointAtFraction, sampleEvenly } from "./arc-length";
import { sharedPointCount } from "./reconcile-density";

/**
 * Two arc-length fractions closer than this count as the same position, so a `from` vertex and a
 * `to` vertex that coincide give one output point, not two a hair apart. On a 100-unit icon's
 * outline that's well under a millionth of a unit: floating-point noise, not geometry.
 */
const MERGE_TOLERANCE = 1e-9;

/** One output point: an arc-length position on `from`, plus the vertex it is on each side, if any. */
type Station = { fraction: number; fromIndex: number | null; toIndex: number | null };

/**
 * Pairs the points of a matched contour pair by arc-length position (spec 07, replacing spec 04
 * #4's index pairing): the point at fraction s around `from`'s perimeter pairs with the point at
 * fraction (s + φ) mod 1 around `to`'s.
 *
 * - **φ** comes from spec 04 #4's rotation search, run on both contours sampled evenly by arc
 *   length at spec 04 #3's shared count N: φ = k / N.
 * - **Output points** sit at the union of `from`'s vertex fractions and `to`'s (shifted by φ), in
 *   order from `from`'s point 0. Each side's vertices land exactly on themselves and every other
 *   point lies on that side's edges, so the end frames are exactly the input outlines. Between two
 *   consecutive output points both sides are straight, so lerping them is exactly the lerp of the
 *   arc-length mapping.
 * - A zero-length contour (a placeholder, or one already collapsed) contributes only its point 0,
 *   so its partner's vertices set the output points.
 *
 * Returns two arrays of equal length, paired by index. Expects at least one point on each side.
 */
export function pairByArcLength(
  from: readonly Point[],
  to: readonly Point[],
): { fromPoints: Point[]; toPoints: Point[] } {
  const count = sharedPointCount(from.length, to.length);
  const shift = findBestRotation(sampleEvenly(from, count), sampleEvenly(to, count)) / count;

  const fromPath = parameterize(from);
  const toPath = parameterize(to);
  const stations: Station[] = [
    ...(fromPath.fractions ?? [0]).map((fraction, index) => ({
      fraction,
      fromIndex: index,
      toIndex: null,
    })),
    ...(toPath.fractions ?? [0]).map((fraction, index) => ({
      fraction: wrapFraction(fraction - shift),
      fromIndex: null,
      toIndex: index,
    })),
  ].sort((a, b) => a.fraction - b.fraction || sideOrder(a) - sideOrder(b));

  // `from`'s point 0 sits at fraction 0, so the sort puts it first; anything within tolerance of
  // the wrap-around (just under 1) is the same position as it.
  const merged: Station[] = [];
  for (const station of stations) {
    const first = merged[0];
    const last = merged[merged.length - 1];
    const target =
      last !== undefined && station.fraction - last.fraction < MERGE_TOLERANCE
        ? last
        : first !== undefined && 1 - station.fraction < MERGE_TOLERANCE
          ? first
          : undefined;
    if (target === undefined) merged.push({ ...station });
    else {
      target.fromIndex ??= station.fromIndex;
      target.toIndex ??= station.toIndex;
    }
  }

  return {
    fromPoints: merged.map(({ fraction, fromIndex }) =>
      fromIndex === null || fromPath.fractions === null
        ? pointAtFraction(fromPath, fraction)
        : { ...(from[fromIndex] as Point) },
    ),
    toPoints: merged.map(({ fraction, toIndex }) =>
      toIndex === null || toPath.fractions === null
        ? pointAtFraction(toPath, wrapFraction(fraction + shift))
        : { ...(to[toIndex] as Point) },
    ),
  };
}

/** Equal fractions: `from` vertices before `to` vertices, each side in its own vertex order. */
function sideOrder(station: Station): number {
  return station.fromIndex !== null ? station.fromIndex : 2 ** 31 + (station.toIndex as number);
}

/** `fraction` mod 1, in 0…1 (exclusive of 1). */
function wrapFraction(fraction: number): number {
  const wrapped = fraction - Math.floor(fraction);
  return wrapped >= 1 ? 0 : wrapped;
}
