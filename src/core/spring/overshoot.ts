import type { Contour } from "../contour";

/**
 * How much larger the target is drawn per unit of spring overshoot past position 1: at 1.3 the
 * target is drawn 6% larger. Small on purpose, a "pop" that reads as the spring overshooting
 * without the icon visibly changing size.
 */
export const OVERSHOOT_SCALE = 0.2;

/**
 * What a leg draws while its spring is past 1 (spec 05's overshoot reopen): the target itself,
 * scaled uniformly by `1 + OVERSHOOT_SCALE × (position − 1)` about the center of its bounding box.
 *
 * Past 1, `interpolate` would extrapolate, and a collapsing hole would turn inside out. A uniform
 * scale of the finished target can't: it keeps every contour's shape, winding and containment, so
 * the overshoot stays visible as a bounce while the geometry stays exactly the target's. At 1 it
 * returns `to` itself. Defined for any finite `position` (below 1 it shrinks), so a numerical
 * derivative can be taken right at 1.
 */
export function popContours(to: Contour[], position: number): Contour[] {
  const scale = 1 + OVERSHOOT_SCALE * (position - 1);
  if (scale === 1) return to;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const contour of to) {
    for (const point of contour.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return to.map((contour) => ({
    ...contour,
    points: contour.points.map((point) => ({
      x: centerX + (point.x - centerX) * scale,
      y: centerY + (point.y - centerY) * scale,
    })),
  }));
}
