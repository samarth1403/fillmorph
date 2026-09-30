import {
  type Contour,
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  FillmorphParseError,
  parseIcon,
} from "fillmorph";

/**
 * Any of core's three parse-time rejections (spec 02): the errors `<FillMorph>`'s `onError` and
 * `useFillMorph`'s `error` carry. A union rather than a base class, since core's error classes
 * share none.
 */
export type FillmorphError =
  | FillmorphMarkupError
  | FillmorphParseError
  | FillmorphIncompatibleIconError;

/** One icon's parse: its canonical-frame contours, or the rejection that stopped it. */
export type IconParse =
  | { contours: Contour[]; error: null }
  | { contours: null; error: FillmorphError };

/**
 * Parses `icon` with core's `parseIcon`, turning a rejection into a value so React code can route
 * it to `onError`. Anything that isn't a `FillmorphError` is a bug rather than a bad icon, so it
 * is re-thrown, never swallowed.
 */
export function parseIconMarkup(icon: string): IconParse {
  try {
    return { contours: parseIcon(icon).contours, error: null };
  } catch (error) {
    if (
      error instanceof FillmorphMarkupError ||
      error instanceof FillmorphParseError ||
      error instanceof FillmorphIncompatibleIconError
    ) {
      return { contours: null, error };
    }
    throw error;
  }
}
