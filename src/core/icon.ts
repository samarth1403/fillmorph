import type { Contour } from "./contour";

/** An SVG `viewBox`: the user-space rectangle the icon's coordinates are drawn in. */
export type ViewBox = { x: number; y: number; width: number; height: number };

/** Everything `parseIcon` extracts from one icon's markup. */
export type ParsedIcon = {
  /**
   * Every closed subpath of the icon, in document order. Points are in **canonical-frame**
   * coordinates (`CANONICAL_VIEW_BOX`, 0 0 100 100), not the icon's original units — render them
   * in a `viewBox="0 0 100 100"`, not in `viewBox` below.
   */
  contours: Contour[];
  /**
   * The icon's **original** frame, in the source markup's own user units: the root `<svg>`'s
   * `viewBox`, or for an icon with no `viewBox` attribute the equivalent
   * `{ x: 0, y: 0, width, height }` from the root's numeric `width`/`height`. Not the coordinate
   * space of `contours`; useful for the source's aspect ratio and intrinsic size.
   */
  viewBox: ViewBox;
};
