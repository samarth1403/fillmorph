import type { Contour, Point } from "../contour";
import { FillmorphParseError } from "../errors";
import type { ParsedIcon } from "../icon";
import { createCanonicalMapping } from "./canonical-frame";
import { classifyFill } from "./classify";
import { describePath, validateIconContract } from "./contract";
import {
  contourTolerance,
  FLATTEN_TOLERANCE_RATIO,
  flattenSubpath,
  measureExtent,
} from "./flatten";
import { signedArea } from "./geometry";
import { type ExtractedPath, type FillRule, parseSvgMarkup } from "./markup";
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
 * 1. Markup parsing - generic, well-formedness only (`FillmorphMarkupError`).
 * 2. Contract validation - first whether this is a morphable kind of icon
 *    (`FillmorphIncompatibleIconError`), then whether each path's geometry is sound
 *    (`FillmorphParseError`). The icon-type check runs first because stroke icons routinely
 *    contain open subpaths, and "this is a stroke icon" is the accurate diagnosis for them.
 *
 * Every subpath of every rendered `<path>` that encloses area becomes one `Contour`, flattened
 * adaptively (content-aware point density, with a tolerance relative to that contour's own size,
 * capped at the icon-wide one - see `contourTolerance`; no cross-icon point-count
 * reconciliation), classified as outer/hole the way a browser fills it (`classifyFill`: each
 * path's `fill-rule` and winding, and never a hole across separate paths), mapped into the
 * canonical frame, and normalized in winding and start point (see `Contour`). Contours are
 * returned in document order, with ids `"c0"`, `"c1"`, … in that order and each non-outer
 * contour's `parentId` pointing at the contour directly around it.
 *
 * Geometry that draws nothing contributes nothing, as in a browser:
 * - elements that draw nothing - `display: none`, or `fill: none` with no visible stroke (such
 *   as Material Design's invisible bounding-box path) - are skipped entirely;
 * - a subpath that encloses no area (a point, or a straight line) is skipped;
 * - a nested subpath that changes no fill (under `nonzero`, one wound the same way as its
 *   container) is dropped.
 *
 * A subpath without "Z" is filled as if closed, as browsers fill it. A path's `fill-opacity` and
 * `opacity` (times its `<g>`s') become its contours' `opacity`.
 *
 * @throws FillmorphMarkupError if the markup is not a well-formed SVG with at least one `<path>`.
 * @throws FillmorphIncompatibleIconError if the icon is outside the compatibility contract.
 * @throws FillmorphParseError if a path's `d` is missing or malformed, no subpath in the icon
 *   encloses any area, or every subpath cancels out under its fill rule (e.g. the same shape drawn
 *   twice under `evenodd`).
 */
export function parseIcon(svg: string): ParsedIcon {
  const markup = parseSvgMarkup(svg);
  const { paths: renderedPaths, viewBox } = validateIconContract(markup);

  const parsedPaths = renderedPaths.map((path) => ({
    path,
    subpaths: readSubpaths(path),
  }));
  const extent = measureExtent(parsedPaths.flatMap(({ subpaths }) => subpaths));
  const tolerance = extent * FLATTEN_TOLERANCE_RATIO;
  const samePointTolerance = extent * SAME_POINT_RATIO;

  // A subpath with no area draws nothing in a browser, so it's skipped rather than rejecting the
  // icon (spec 11 #2); only an icon left with nothing at all is an error.
  const layers = parsedPaths.map(({ path, subpaths }) => ({
    path,
    polygons: subpaths.flatMap((subpath) => {
      const polygon = buildPolygon(subpath, tolerance, samePointTolerance, extent);
      return polygon === null ? [] : [polygon];
    }),
    fillRule: path.fillRule,
  }));
  const polygons = layers.flatMap((layer) => layer.polygons);
  if (polygons.length === 0) {
    throw new FillmorphParseError(
      "None of the icon's subpaths encloses any area (every one is a point or a straight line), " +
        "so it draws nothing fillmorph can morph.",
    );
  }
  const opacities = layers.flatMap(({ path, polygons: own }) => own.map(() => path.opacity));

  const classified = classifyFill(layers, tolerance);
  if (classified.every((entry) => entry === null)) throw canceledOutError(layers);
  // Polygons that bound nothing (filled on both sides) are dropped; ids stay consecutive.
  const idOf = new Map<number, string>();
  classified.forEach((entry, index) => {
    if (entry !== null) idOf.set(index, contourId(idOf.size));
  });
  // Mapped before winding/start-point normalization so those invariants hold exactly in the
  // coordinates actually returned. A uniform positive scale can't change winding or which point
  // is topmost/leftmost, but float rounding could perturb an exact tie.
  const { scale, toCanonical } = createCanonicalMapping(viewBox);
  const contours = classified.flatMap((entry, index): Contour[] => {
    if (entry === null) return [];
    const { isHole, depth, parentIndex } = entry;
    const opacity = opacities[index] as number;
    const contour: Contour = {
      id: idOf.get(index) as string,
      parentId: parentIndex === null ? null : (idOf.get(parentIndex) as string),
      points: normalizeContour(
        (polygons[index] as Point[]).map(toCanonical),
        isHole,
        samePointTolerance * scale,
      ),
      isHole,
      depth,
    };
    return [opacity === 1 ? contour : { ...contour, opacity }];
  });
  return { contours, viewBox };
}

/**
 * The rejection for an icon whose subpaths all enclose area but fully cancel each other out under
 * their fill rules (spec 13 #1), so a browser draws nothing. Rather than morph to a silently blank
 * icon, the message names the paths and how each rule cancels.
 */
function canceledOutError(
  layers: readonly { path: ExtractedPath; polygons: readonly Point[][]; fillRule: FillRule }[],
): FillmorphParseError {
  const drawing = layers.filter((layer) => layer.polygons.length > 0);
  const rules = new Set(drawing.map((layer) => layer.fillRule));
  const causes = [...rules].map((rule) =>
    rule === "evenodd"
      ? 'under the "evenodd" fill rule, an area covered an even number of times is left unfilled, so the same outline drawn twice cancels itself'
      : 'under the "nonzero" fill rule, the same outline drawn once in each direction (clockwise and counter-clockwise) adds up to zero winding and cancels itself',
  );
  return new FillmorphParseError(
    `Every subpath of ${drawing.map(({ path }) => describePath(path)).join(", ")} cancels out ` +
      `under its fill rule, so the icon draws nothing (a browser renders it blank): ${causes.join("; ")}. ` +
      "Remove the duplicated outlines, or check the path's fill-rule.",
  );
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

/**
 * Flattens one subpath into a closed polygon, or returns `null` if it encloses no area.
 *
 * A subpath without `Z` is closed by a straight line back to its start, which is exactly how SVG
 * fills it (spec 11 #2): the fill of an open subpath is drawn as if it ended in "Z".
 */
function buildPolygon(
  subpath: Subpath,
  tolerance: number,
  samePointTolerance: number,
  extent: number,
): Point[] | null {
  // Flattening uses the contour's own (capped) tolerance so small contours stay as smooth as
  // large ones; the closing and classification checks keep the icon-wide one, since they absorb
  // exporter rounding in absolute units rather than judging smoothness.
  const flattened = flattenSubpath(subpath, contourTolerance(subpath, tolerance));

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
    return null;
  }
  return points;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
