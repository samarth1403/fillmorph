import type { Point } from "../contour";
import type { ViewBox } from "../icon";

/**
 * The shared coordinate frame every parsed icon's contour points are expressed in: a
 * 100 × 100 square at the origin, whatever the icon's own `viewBox` was. Icons of different native
 * sizes (a 16-unit and a 512-unit icon) can then be compared and morphed directly.
 */
export const CANONICAL_VIEW_BOX: Readonly<ViewBox> = Object.freeze({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});

/** A uniform scale plus translation from an icon's original `viewBox` to the canonical frame. */
export type CanonicalMapping = {
  /** Canonical units per original user unit — the same on both axes. */
  scale: number;
  toCanonical: (point: Point) => Point;
};

/**
 * Maps an icon's original `viewBox` into `CANONICAL_VIEW_BOX`:
 *
 * - **Uniform scale**, never stretched: `scale = 100 / max(viewBox.width, viewBox.height)`, so
 *   the viewBox's longest side spans the full 100 units and the aspect ratio is preserved.
 * - **Centered on the viewBox, not on the geometry:** the scaled viewBox rectangle is centered in
 *   the 100 × 100 frame (only the shorter axis gets an offset). The icon keeps its authored
 *   position and padding inside its own frame; a glyph drawn off-center in its viewBox stays
 *   off-center.
 *
 * This is exactly how a browser draws the viewBox into a square viewport under SVG's default
 * `preserveAspectRatio="xMidYMid meet"`. So canonical contours rendered in a square
 * `viewBox="0 0 100 100"` line up with the source icon rendered in a same-size square viewport.
 * A non-default `preserveAspectRatio` on the source root is not honored.
 *
 * Expects a viewBox with positive width and height, which stage 2 guarantees.
 */
export function createCanonicalMapping(viewBox: ViewBox): CanonicalMapping {
  const scale = CANONICAL_VIEW_BOX.width / Math.max(viewBox.width, viewBox.height);
  const offsetX = (CANONICAL_VIEW_BOX.width - viewBox.width * scale) / 2;
  const offsetY = (CANONICAL_VIEW_BOX.height - viewBox.height * scale) / 2;
  return {
    scale,
    toCanonical: (point) => ({
      x: CANONICAL_VIEW_BOX.x + offsetX + (point.x - viewBox.x) * scale,
      y: CANONICAL_VIEW_BOX.y + offsetY + (point.y - viewBox.y) * scale,
    }),
  };
}
