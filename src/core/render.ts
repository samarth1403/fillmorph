import type { Contour } from "./contour";

/**
 * Coordinates are written to 3 decimal places. In the 100-unit canonical frame that is 1/100 000
 * of the icon's size (0.005 px even at 512 px), well below anything visible, and it keeps the
 * output short and deterministic.
 */
const DECIMAL_PLACES = 3;
const ROUNDING = 10 ** DECIMAL_PLACES;

/**
 * Renders contours as one SVG path `d` string: one closed `M … L … Z` subpath per contour, in
 * array order. Pure geometry only - no `viewBox`, size or color; placing the path in an `<svg>`
 * is the caller's job, and the viewBox to use for canonical-frame contours is
 * `CANONICAL_VIEW_BOX`.
 *
 * Holes render as holes under SVG's default `fill-rule` (`nonzero`), and under `evenodd` too,
 * **provided the contours follow `parseIcon`'s winding invariant** (outer contours
 * counter-clockwise on screen, holes clockwise; see `Contour`). Nothing is re-wound here.
 *
 * Coordinates are rounded to 3 decimal places. A contour with no points contributes nothing.
 * Points must be finite numbers; a `NaN` or infinite coordinate is not detected and makes the
 * resulting path invalid.
 */
export function renderContours(contours: readonly Contour[]): string {
  const subpaths: string[] = [];
  for (const contour of contours) {
    const [first, ...rest] = contour.points;
    if (first === undefined) continue;
    let subpath = `M${formatNumber(first.x)} ${formatNumber(first.y)}`;
    for (const point of rest)
      subpath += `L${formatNumber(point.x)} ${formatNumber(point.y)}`;
    subpaths.push(`${subpath}Z`);
  }
  return subpaths.join("");
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * ROUNDING) / ROUNDING;
  // Rounding a tiny negative value yields -0, which would print as "0" anyway but is normalized
  // explicitly so the output never depends on String(-0)'s behavior.
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
