/**
 * A 2D point (y points down, as in SVG). In a parsed `Contour`, points are in the canonical frame
 * (`CANONICAL_VIEW_BOX`, 0 0 100 100), not in the source icon's own viewBox units.
 */
export type Point = { x: number; y: number };

/**
 * One closed, flattened outline of a parsed icon.
 *
 * Invariants guaranteed by `parseIcon`:
 * - `points` are in canonical-frame coordinates (`CANONICAL_VIEW_BOX`), never the source icon's
 *   original viewBox units: the viewBox's longest side is scaled uniformly to 100 and centered.
 * - `points` is a closed polyline with curves already subdivided; the closing edge from the last
 *   point back to the first is implicit (the first point is not repeated at the end).
 * - Winding is normalized: outer contours (`isHole: false`) run counter-clockwise as displayed on
 *   screen (negative shoelace area in SVG's y-down coordinates); holes run clockwise.
 * - `points[0]` is the topmost point (smallest y), ties broken by leftmost (smallest x).
 * - `parentId` is `null` exactly when `depth` is 0; otherwise it names a contour in the same
 *   result whose `depth` is one less and whose `isHole` is the opposite.
 * - `isHole` is how a browser fills the source (spec 11): it follows each `<path>`'s `fill-rule`
 *   and winding, and one `<path>` never cuts a hole in another.
 */
export type Contour = {
  /**
   * Identifies this contour within one `parseIcon` result (`"c0"`, `"c1"`, … in document order).
   * Unique only within that result - two parsed icons both have a `"c0"`.
   */
  id: string;
  /** `id` of the innermost contour containing this one; `null` for depth-0 outer contours. */
  parentId: string | null;
  points: Point[];
  isHole: boolean;
  /** Nesting depth: 0 = outermost, 1 = a hole in it, 2 = a shape inside that hole. */
  depth: number;
  /**
   * How opaque this contour's fill draws, 0–1 (spec 11): a two-tone icon's faded layer has, say,
   * 0.3. Absent means fully opaque (1), which is how `parseIcon` and `interpolate` leave every
   * opaque contour. A hole draws in its parent's layer (see `renderLayers`), so only a filled
   * contour's value is visible.
   */
  opacity?: number;
};
