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
 * Thrown when the SVG is well-formed but a path's geometry is broken: malformed `d` syntax, an
 * open (unclosed) subpath, or a degenerate zero-area subpath.
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
