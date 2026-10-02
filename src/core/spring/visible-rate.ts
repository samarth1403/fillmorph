import type { Contour, Point } from "../contour";
import { interpolate } from "../morph/interpolate";
import { popContours } from "./overshoot";

/** Step for the numerical derivative of `interpolate` with respect to progress. */
const DERIVATIVE_STEP = 1e-4;

/**
 * How fast a morph from `from` to `to` visibly moves the shape per unit of progress, at
 * `progress`: `outlineRate` of `interpolate(from, to, ·)`.
 */
export function visibleRate(from: Contour[], to: Contour[], progress: number): number {
  return outlineRate((at) => interpolate(from, to, at), progress);
}

/**
 * How fast the drawn shape moves per unit of progress while the spring overshoots past 1, where
 * the leg draws `popContours(to, ·)` (spec 05's overshoot reopen).
 */
export function overshootRate(to: Contour[], progress: number): number {
  return outlineRate((at) => popContours(to, at), progress);
}

/**
 * How fast the shape drawn by `frameAt` visibly moves per unit of progress, at `progress`: the
 * root-mean-square, over the drawn outline, of each vertex's velocity perpendicular to the
 * outline, weighted by the length of outline the vertex stands for (half of each adjacent edge).
 * Canonical units per unit of progress.
 *
 * This is spec 03 #7's definition of visible speed, which its velocity-continuity check grades
 * against with its own implementation. Motion *along* the outline redraws the same shape, so it
 * doesn't count; zero-length contours (collapsed or not-yet-grown placeholders) draw nothing and
 * weigh nothing. Returns 0 when nothing is drawn. `frameAt` must give the same contour structure
 * (ids, point counts) at nearby progress values.
 */
function outlineRate(frameAt: (progress: number) => Contour[], progress: number): number {
  const before = frameAt(progress - DERIVATIVE_STEP);
  const now = frameAt(progress);
  const after = frameAt(progress + DERIVATIVE_STEP);
  let weightedSquares = 0;
  let totalLength = 0;
  // `frameAt`'s output tree and point counts don't depend on progress, so the three frames line up
  // index for index.
  for (const [index, contour] of now.entries()) {
    const points = contour.points;
    const earlier = (before[index] as Contour).points;
    const later = (after[index] as Contour).points;
    for (const [pointIndex, point] of points.entries()) {
      const previous = points[(pointIndex - 1 + points.length) % points.length] as Point;
      const next = points[(pointIndex + 1) % points.length] as Point;
      const tangentX = next.x - previous.x;
      const tangentY = next.y - previous.y;
      const tangentLength = Math.hypot(tangentX, tangentY);
      const weight =
        (Math.hypot(point.x - previous.x, point.y - previous.y) +
          Math.hypot(next.x - point.x, next.y - point.y)) /
        2;
      if (tangentLength === 0 || weight === 0) continue;
      const start = earlier[pointIndex] as Point;
      const end = later[pointIndex] as Point;
      const across = ((end.x - start.x) * -tangentY + (end.y - start.y) * tangentX) / tangentLength;
      weightedSquares += weight * across * across;
      totalLength += weight;
    }
  }
  return totalLength === 0 ? 0 : Math.sqrt(weightedSquares / totalLength) / (2 * DERIVATIVE_STEP);
}
