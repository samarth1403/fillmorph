import {
  type Contour,
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  FillmorphParseError,
  parseIcon,
} from "fillmorph";
import { useMemo } from "react";
import {
  type FillMorphIcon,
  iconInputError,
  type ResolvedIcon,
  useResolvedIcon,
} from "./icon-source";

/**
 * Any of core's three parse-time rejections (spec 02): the errors `<FillMorph>`'s `onError` and
 * `useFillMorph`'s `error` carry. A union rather than a base class, since core's error classes
 * share none. An icon no markup can be had from (neither a string nor a React element, or an
 * element when `react-dom/server` won't load) is a `FillmorphIconInputError` (spec 09), a
 * `FillmorphMarkupError` subclass.
 */
export type FillmorphError =
  | FillmorphMarkupError
  | FillmorphParseError
  | FillmorphIncompatibleIconError;

/**
 * One icon's parse: its canonical-frame contours, the rejection that stopped it, or neither while
 * an element icon waits for `react-dom/server` to load (spec 09).
 */
export type IconParse =
  | { contours: Contour[]; error: null }
  | { contours: null; error: FillmorphError }
  | { contours: null; error: null };

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

/**
 * A resolved icon's parse, memoized on its markup rather than on the icon's identity, so a JSX
 * element recreated on every render (`icon={<FaHeart />}`) doesn't re-parse or look like a new
 * target each time.
 */
export function useParsedIcon(icon: ResolvedIcon): IconParse {
  const { markup, invalid } = icon;
  return useMemo(() => {
    if (markup !== null) return parseIconMarkup(markup);
    if (invalid !== null) return { contours: null, error: iconInputError(invalid) };
    return { contours: null, error: null };
  }, [markup, invalid]);
}

/** `icon`, markup or element, resolved and parsed. See `useParsedIcon` for the memoization. */
export function useIconParse(icon: FillMorphIcon): IconParse {
  return useParsedIcon(useResolvedIcon(icon));
}
