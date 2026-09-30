import type { Contour, Point } from "../contour";
import { FillmorphParseError } from "../errors";
import type { ParsedIcon } from "../icon";
import { createCanonicalMapping } from "./canonical-frame";
import { classifyNesting, type Nesting } from "./classify";
import { describePath, validateIconContract } from "./contract";
import {
  contourTolerance,
  FLATTEN_TOLERANCE_RATIO,
  flattenSubpath,
  measureExtent,
} from "./flatten";
import { signedArea } from "./geometry";
import { type ExtractedPath, parseSvgMarkup } from "./markup";
import { normalizeContour } from "./normalize";
import { PathDataSyntaxError, parsePathData, type Subpath } from "./path-data";

/**
 * Below this fraction of the icon's size, two coordinates are treated as the same point (duplicate
 * removal, start-point tie-breaking). Far below anything visible; only absorbs float noise.
 */
const SAME_POINT_RATIO = 1e-9;

/** A subpath enclosing less than this fraction of the icon's squared size has no real area. */
const DEGENERATE_AREA_RATIO = 1e-9;

/**
 * Parses a filled SVG icon's full markup into normalized, hole-classified contours plus the
 * icon's original `viewBox`.
 *
 * The two return fields are in **different coordinate spaces**, on purpose:
 * - `contours[].points` are in the shared canonical frame (`CANONICAL_VIEW_BOX`, 0 0 100 100):
 *   uniformly scaled so the viewBox's longest side spans 100 units, and centered. So contours
 *   from icons of any native size are directly comparable.
 * - `viewBox` is the icon's *original* viewBox, in the source markup's own user units. It is not
 *   the frame `contours` are in; render contours in `CANONICAL_VIEW_BOX`.
 *
 * Error messages quote coordinates in the source's original user units, since that's what the
 * author sees in their `d` data.
 *
 * Runs in two separate stages:
 * 1. Markup parsing — generic, well-formedness only (`FillmorphMarkupError`).
 * 2. Contract validation — first whether this is a morphable kind of icon
 *    (`FillmorphIncompatibleIconError`), then whether each path's geometry is sound
 *    (`FillmorphParseError`). The icon-type check runs first because stroke icons routinely
 *    contain open subpaths, and "this is a stroke icon" is the accurate diagnosis for them.
 *
 * Every closed subpath of every rendered `<path>` becomes one `Contour`, flattened adaptively
 * (content-aware point density, with a tolerance relative to that contour's own size, capped at
 * the icon-wide one — see `contourTolerance`; no cross-icon point-count reconciliation),
 * classified as outer/hole by containment, mapped into the canonical frame, and normalized in
 * winding and start point (see `Contour`). Contours are returned in document order, with ids `"c0"`, `"c1"`, … in that order
 * and each non-outer contour's `parentId` pointing at its innermost container.
 *
 * @throws FillmorphMarkupError if the markup is not a well-formed SVG with at least one `<path>`.
 * @throws FillmorphIncompatibleIconError if the icon is outside the compatibility contract.
 * @throws FillmorphParseError if a path's `d` is malformed, open, or degenerate.
 */
export function parseIcon(svg: string): ParsedIcon {
  const markup = parseSvgMarkup(svg);
  const { paths: renderedPaths, viewBox } = validateIconContract(markup);

  const parsedPaths = renderedPaths.map((path) => ({ path, subpaths: readSubpaths(path) }));
  const extent = measureExtent(parsedPaths.flatMap(({ subpaths }) => subpaths));
  const tolerance = extent * FLATTEN_TOLERANCE_RATIO;
  const samePointTolerance = extent * SAME_POINT_RATIO;

  const polygons = parsedPaths.flatMap(({ path, subpaths }) =>
    subpaths.map((subpath, subpathIndex) =>
      buildPolygon(subpath, tolerance, samePointTolerance, extent, () =>
        describeSubpath(path, subpathIndex),
      ),
    ),
  );

  const nesting = classifyNesting(polygons, tolerance);
  // Mapped before winding/start-point normalization so those invariants hold exactly in the
  // coordinates actually returned. A uniform positive scale can't change winding or which point
  // is topmost/leftmost, but float rounding could perturb an exact tie.
  const { scale, toCanonical } = createCanonicalMapping(viewBox);
  const contours = polygons.map((points, index): Contour => {
    const { depth, parentIndex } = nesting[index] as Nesting;
    const isHole = depth % 2 === 1;
    return {
      id: contourId(index),
      parentId: parentIndex === null ? null : contourId(parentIndex),
      points: normalizeContour(points.map(toCanonical), isHole, samePointTolerance * scale),
      isHole,
      depth,
    };
  });
  return { contours, viewBox };
}

function contourId(index: number): string {
  return `c${index}`;
}

function readSubpaths(path: ExtractedPath): Subpath[] {
  if (path.d === undefined) {
    throw new FillmorphParseError(
      `${describePath(path)} has no "d" attribute, so it has no geometry.`,
    );
  }
  try {
    return parsePathData(path.d);
  } catch (error) {
    if (!(error instanceof PathDataSyntaxError)) throw error;
    throw new FillmorphParseError(
      `${describePath(path)} has malformed path data at character ${error.offset}: ${error.message}.`,
    );
  }
}

function buildPolygon(
  subpath: Subpath,
  tolerance: number,
  samePointTolerance: number,
  extent: number,
  describe: () => string,
): Point[] {
  // Flattening uses the contour's own (capped) tolerance so small contours stay as smooth as
  // large ones; the closing and classification checks keep the icon-wide one, since they absorb
  // exporter rounding in absolute units rather than judging smoothness.
  const flattened = flattenSubpath(subpath, contourTolerance(subpath, tolerance));
  const end = flattened[flattened.length - 1] as Point;
  if (!subpath.hasClosePath && distance(end, subpath.start) > tolerance) {
    throw new FillmorphParseError(
      `${describe()} is open: it doesn't end with "Z" and its end point ${formatPoint(end)} ` +
        `doesn't return to its start ${formatPoint(subpath.start)}. fillmorph only morphs closed ` +
        'filled shapes — close the subpath with "Z".',
    );
  }

  const points: Point[] = [];
  for (const point of flattened) {
    const previous = points[points.length - 1];
    if (!previous || distance(previous, point) > samePointTolerance) points.push(point);
  }
  // Closing (explicit `Z` or implicit) is represented by the implicit last-to-first edge.
  while (
    points.length > 1 &&
    distance(points[points.length - 1] as Point, points[0] as Point) <= tolerance
  ) {
    points.pop();
  }

  if (
    points.length < 3 ||
    Math.abs(signedArea(points)) <= extent * extent * DEGENERATE_AREA_RATIO
  ) {
    throw new FillmorphParseError(
      `${describe()} is degenerate: it encloses no area (its points are coincident or collinear). ` +
        "Remove it from the path data.",
    );
  }
  return points;
}

function describeSubpath(path: ExtractedPath, subpathIndex: number): string {
  return `Subpath ${subpathIndex + 1} of ${describePath(path)}`;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatPoint(point: Point): string {
  return `(${Number(point.x.toFixed(3))}, ${Number(point.y.toFixed(3))})`;
}
