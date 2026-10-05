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
    for (const point of rest) subpath += `L${formatNumber(point.x)} ${formatNumber(point.y)}`;
    subpaths.push(`${subpath}Z`);
  }
  return subpaths.join("");
}

/** One `<path>` of a layered render: its `d`, and the `fill-opacity` to draw it with. */
export type RenderLayer = { d: string; opacity: number };

/**
 * Renders contours as one `<path>` per distinct opacity (spec 11), so a two-tone icon's faded
 * layer stays faded: draw each as `<path d={layer.d} fill-opacity={layer.opacity}>`, in order,
 * inside a `CANONICAL_VIEW_BOX` `<svg>`. Fully opaque contours (`opacity` absent or 1) are one
 * layer, so an icon with no translucent parts renders as exactly one layer whose `d` is
 * `renderContours(contours)`. No contours, no layers.
 *
 * A hole always goes in its parent's layer, whatever its own `opacity`, since a hole only cuts the
 * `<path>` it's drawn in; a hole whose parent isn't in `contours` uses its own. Layers are ordered
 * by where their first contour appears. With a single fill colour, the order doesn't change the
 * result, since overlapping translucent layers combine the same either way.
 *
 * Opacities are grouped after rounding to 3 decimal places, the precision `renderContours` writes
 * coordinates at, so values that differ only by float noise share a layer. Each layer's `d`
 * follows `renderContours`' rules, including its winding requirement.
 */
export function renderLayers(contours: readonly Contour[]): RenderLayer[] {
  const byId = new Map(contours.map((contour) => [contour.id, contour]));
  const layerOpacityOf = (contour: Contour): number => {
    const parent =
      contour.isHole && contour.parentId !== null ? byId.get(contour.parentId) : undefined;
    return Math.round(((parent ?? contour).opacity ?? 1) * ROUNDING) / ROUNDING;
  };

  const groups = new Map<number, Contour[]>();
  for (const contour of contours) {
    const opacity = layerOpacityOf(contour);
    const group = groups.get(opacity);
    if (group === undefined) groups.set(opacity, [contour]);
    else group.push(contour);
  }
  return [...groups].map(([opacity, group]) => ({ d: renderContours(group), opacity }));
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * ROUNDING) / ROUNDING;
  // Rounding a tiny negative value yields -0, which would print as "0" anyway but is normalized
  // explicitly so the output never depends on String(-0)'s behavior.
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
