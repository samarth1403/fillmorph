/**
 * `fillmorph` — the zero-dependency core: pure geometry and animation math.
 *
 * The morph core and spring step function land in specs 04 and 05. `renderContours` (spec 03) is
 * the one contour-to-`d` renderer every consumer shares.
 */
export type { Contour, Point } from "./contour";
export {
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  FillmorphParseError,
} from "./errors";
export type { ParsedIcon, ViewBox } from "./icon";
export { CANONICAL_VIEW_BOX } from "./parse/canonical-frame";
export { parseIcon } from "./parse/parse-icon";
export { renderContours } from "./render";
