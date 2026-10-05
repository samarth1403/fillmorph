/**
 * `fillmorph` - the zero-dependency core: pure geometry and animation math.
 *
 * `parseIcon` (spec 02) turns markup into canonical-frame contours, `interpolate` (spec 04) gives
 * the morph's geometry at any progress, and `renderContours` (spec 03) is the one contour-to-`d`
 * renderer every consumer shares. `stepSpring` (spec 05) advances a caller-owned spring state, and
 * `startMorph` / `advanceMorph` / `retargetMorph` apply it to a whole morph, including the
 * interruption rule, as pure state transitions that `fillmorph/dom`'s driver schedules.
 */
export type { Contour, Point } from "./contour";
export {
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  FillmorphParseError,
} from "./errors";
export type { ParsedIcon, ViewBox } from "./icon";
export { interpolate } from "./morph/interpolate";
export { CANONICAL_VIEW_BOX } from "./parse/canonical-frame";
export { parseIcon } from "./parse/parse-icon";
export type { RenderLayer } from "./render";
export { renderContours, renderLayers } from "./render";
export type { MorphState } from "./spring/morph-state";
export { advanceMorph, retargetMorph, startMorph } from "./spring/morph-state";
export type { SpringConfig, SpringState } from "./spring/step-spring";
export { stepSpring } from "./spring/step-spring";
