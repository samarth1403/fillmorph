/**
 * Thrown when the input is not a well-formed SVG document: malformed XML, a root element other
 * than `<svg>`, or no `<path>` element anywhere in it. Raised before any other judgement about
 * whether the icon's content is morphable, except one: an icon with no `<path>` that draws only
 * strokes (e.g. a `<circle>` outline) gets `FillmorphIncompatibleIconError` instead.
 */
export class FillmorphMarkupError extends Error {
  override name = "FillmorphMarkupError";
}

/**
 * Thrown when the SVG is well-formed but its geometry is unusable: a path with missing or
 * malformed `d` data, an icon where no subpath encloses any area, or one whose subpaths all
 * cancel out under their fill rules (e.g. the same shape drawn twice under `evenodd`), which a
 * browser renders blank.
 */
export class FillmorphParseError extends Error {
  override name = "FillmorphParseError";
}

/**
 * Thrown when the SVG is well-formed but the icon is outside fillmorph's compatibility contract:
 * a path whose effective fill is `none` (a stroke icon), or an unsupported element or attribute
 * such as a transform, `<use>`, a non-`<path>` shape, a gradient/pattern fill, or a mask/clip.
 */
export class FillmorphIncompatibleIconError extends Error {
  override name = "FillmorphIncompatibleIconError";
}

/** Every fillmorph error's `name`, including `fillmorph/react`'s `FillmorphIconInputError`. */
const ERROR_NAMES: ReadonlySet<string> = new Set([
  "FillmorphMarkupError",
  "FillmorphParseError",
  "FillmorphIncompatibleIconError",
  "FillmorphIconInputError",
]);

/**
 * Whether `value` is one of fillmorph's errors, judged by its `name` rather than `instanceof`.
 *
 * Use it when an app might load fillmorph twice, typically its ESM and CommonJS builds side by
 * side through mixed tooling (spec 13 #4). Each copy has its own error classes, so an error thrown
 * by one copy fails `instanceof` against the other copy's class. `name` is the same in both.
 * Check `error.name` afterwards to tell the kinds apart.
 */
export function isFillmorphError(
  value: unknown,
): value is FillmorphMarkupError | FillmorphParseError | FillmorphIncompatibleIconError {
  if (typeof value !== "object" || value === null) return false;
  const { name } = value as { name?: unknown };
  return typeof name === "string" && ERROR_NAMES.has(name);
}
