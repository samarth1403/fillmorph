import type { Contour } from "fillmorph";

/**
 * Spec 05's overshoot rule, implemented here independently of core so the harness grades core's
 * version rather than restating it: once a leg has arrived (its spring first reached position 1),
 * it draws its target scaled by `1 + 0.2 × (position − 1)` about the center of the target's
 * bounding box.
 */
export const OVERSHOOT_FACTOR = 0.2;

/** The leg's target as spec 05 draws it after arrival, at `position`. */
export function poppedTarget(to: readonly Contour[], position: number): Contour[] {
  const scale = 1 + OVERSHOOT_FACTOR * (position - 1);
  const points = to.flatMap((contour) => contour.points);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  return to.map((contour) => ({
    ...contour,
    points: contour.points.map((point) => ({
      x: centerX + (point.x - centerX) * scale,
      y: centerY + (point.y - centerY) * scale,
    })),
  }));
}

/**
 * For each trace entry, whether its leg had arrived by then: some entry of the same leg, at or
 * before it, had position ≥ 1. Read from the trace itself, not from core's state.
 */
export function arrivedFlags(entries: readonly { leg: number; position: number }[]): boolean[] {
  const arrivedLegs = new Set<number>();
  return entries.map((entry) => {
    if (entry.position >= 1) arrivedLegs.add(entry.leg);
    return arrivedLegs.has(entry.leg);
  });
}
