import type { Point } from "../contour";
import { signedArea } from "./geometry";

/**
 * Normalizes one closed polygon's winding and start point, deterministically:
 *
 * 1. Winding - outer contours run counter-clockwise as displayed (negative shoelace area in
 *    SVG's y-down coordinates), holes clockwise, whatever the authored direction or fill-rule.
 * 2. Start point - the array is rotated to begin at the topmost point (smallest y), ties broken
 *    by leftmost (smallest x). Points whose y is within `tieTolerance` of the minimum count as
 *    tied, so floating-point noise on a flat top edge can't pick the right-hand end.
 *
 * The same polygon therefore normalizes to the same array no matter which vertex it was
 * authored to start at or which way it was authored to run. Returns a new array; the input is
 * not modified. Expects a polygon with no repeated closing point and non-zero area.
 */
export function normalizeContour(
  points: readonly Point[],
  isHole: boolean,
  tieTolerance: number,
): Point[] {
  const isCounterClockwiseOnScreen = signedArea(points) < 0;
  const oriented =
    isCounterClockwiseOnScreen === !isHole
      ? [...points]
      : [...points].reverse();
  const startIndex = findCanonicalStart(oriented, tieTolerance);
  return [...oriented.slice(startIndex), ...oriented.slice(0, startIndex)];
}

function findCanonicalStart(
  points: readonly Point[],
  tieTolerance: number,
): number {
  let minY = Number.POSITIVE_INFINITY;
  for (const point of points) minY = Math.min(minY, point.y);

  let bestIndex = -1;
  points.forEach((point, index) => {
    if (point.y > minY + tieTolerance) return;
    const best = points[bestIndex];
    // Exact ties on x fall back to y, then to the lower index, so the choice is always unique.
    if (!best || point.x < best.x || (point.x === best.x && point.y < best.y)) {
      bestIndex = index;
    }
  });
  return bestIndex;
}
