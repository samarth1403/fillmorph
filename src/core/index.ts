/**
 * `fillmorph` — the zero-dependency core: pure geometry and animation math.
 *
 * `parseIcon` (spec 02) turns markup into canonical-frame contours, `interpolate` (spec 04) gives
 * the morph's geometry at any progress, and `renderContours` (spec 03) is the one contour-to-`d`
 * renderer every consumer shares. The spring step function lands in spec 05.
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
export { renderContours } from "./render";
