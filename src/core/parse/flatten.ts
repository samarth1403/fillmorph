import type { Point } from "../contour";
import { distanceToSegment } from "./geometry";
import type { Segment, Subpath } from "./path-data";

/**
 * Maximum distance a flattened polyline may stray from the true curve, as a fraction of a size
 * (see `measureExtent`). Relative rather than absolute so a 16-unit and a 512-unit viewBox get the
 * same visual fidelity. Applied per contour, capped by the icon-wide value; see
 * `contourTolerance`.
 */
export const FLATTEN_TOLERANCE_RATIO = 0.001;

/**
 * The flattening tolerance for one contour: `FLATTEN_TOLERANCE_RATIO` × the contour's own extent,
 * capped at `iconTolerance` (the same ratio × the whole icon's extent).
 *
 * Why not one tolerance for the whole icon: an absolute error bound lets a small circle meet it
 * with far fewer points than a large one (the count grows only with the square root of the
 * radius), so a small inner contour came out visibly faceted - on FA's bullseye, the innermost
 * disc was a 16-gon with 23° turns while the outer ring had 64 points. Relative to its own size,
 * every contour gets the same angular smoothness, however small or deeply nested. The cap only
 * ever tightens the tolerance, so a contour as large as the icon keeps exactly the icon-wide value
 * and no contour gets fewer points than a single icon-wide tolerance would give it.
 */
export function contourTolerance(
  subpath: Subpath,
  iconTolerance: number,
): number {
  return Math.min(
    iconTolerance,
    measureExtent([subpath]) * FLATTEN_TOLERANCE_RATIO,
  );
}

/** Hard stop for recursive subdivision; only reachable with pathological input. */
const MAX_SUBDIVISION_DEPTH = 16;

/**
 * Flattens one subpath into a polyline: lines stay as their end points, while Béziers and arcs
 * are adaptively subdivided until every piece is within `tolerance` of the true curve - tight
 * curves get more points, gentle ones fewer. The result starts with `subpath.start` and still
 * contains any exact duplicate points; cleanup is the caller's job.
 */
export function flattenSubpath(subpath: Subpath, tolerance: number): Point[] {
  const points: Point[] = [subpath.start];
  let current = subpath.start;
  for (const segment of subpath.segments) {
    flattenSegment(current, segment, tolerance, points);
    current = segment.to;
  }
  return points;
}

/**
 * The size of some geometry for tolerance purposes: the larger side of the bounding box of every
 * end point and control point in `subpaths`. Arcs count through the control points of the ≤90°
 * cubics they're flattened as (see `arcToCubics`), so an arc measures like the equivalent Bézier
 * curve: a full circle of diameter D measures D, not more.
 *
 * Called on the whole icon for the icon-wide tolerance, and on one subpath for that contour's own
 * tolerance (see `contourTolerance`).
 */
export function measureExtent(subpaths: readonly Subpath[]): number {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const include = (point: Point): void => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  };
  for (const subpath of subpaths) {
    include(subpath.start);
    let current = subpath.start;
    for (const segment of subpath.segments) {
      if (segment.kind === "cubic") {
        include(segment.ctrl1);
        include(segment.ctrl2);
      } else if (segment.kind === "quadratic") {
        include(segment.ctrl);
      } else if (segment.kind === "arc") {
        for (const [, ctrl1, ctrl2] of arcToCubics(current, segment)) {
          include(ctrl1);
          include(ctrl2);
        }
      }
      include(segment.to);
      current = segment.to;
    }
  }
  const extent = Math.max(maxX - minX, maxY - minY);
  return Number.isFinite(extent) && extent > 0 ? extent : 1;
}

function flattenSegment(
  from: Point,
  segment: Segment,
  tolerance: number,
  out: Point[],
): void {
  switch (segment.kind) {
    case "line":
      out.push(segment.to);
      return;
    case "cubic":
      flattenCubic(
        from,
        segment.ctrl1,
        segment.ctrl2,
        segment.to,
        tolerance,
        0,
        out,
      );
      return;
    case "quadratic": {
      // Degree elevation: the exact cubic equivalent of a quadratic Bézier.
      const ctrl1 = lerp(from, segment.ctrl, 2 / 3);
      const ctrl2 = lerp(segment.to, segment.ctrl, 2 / 3);
      flattenCubic(from, ctrl1, ctrl2, segment.to, tolerance, 0, out);
      return;
    }
    case "arc":
      for (const cubic of arcToCubics(from, segment)) {
        flattenCubic(cubic[0], cubic[1], cubic[2], cubic[3], tolerance, 0, out);
      }
      return;
  }
}

function flattenCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tolerance: number,
  depth: number,
  out: Point[],
): void {
  // The curve lies inside its control hull, so if both inner control points are within
  // tolerance of the chord, the whole curve is.
  const flatness = Math.max(
    distanceToSegment(p1, p0, p3),
    distanceToSegment(p2, p0, p3),
  );
  if (flatness <= tolerance || depth >= MAX_SUBDIVISION_DEPTH) {
    out.push(p3);
    return;
  }
  const p01 = lerp(p0, p1, 0.5);
  const p12 = lerp(p1, p2, 0.5);
  const p23 = lerp(p2, p3, 0.5);
  const p012 = lerp(p01, p12, 0.5);
  const p123 = lerp(p12, p23, 0.5);
  const mid = lerp(p012, p123, 0.5);
  flattenCubic(p0, p01, p012, mid, tolerance, depth + 1, out);
  flattenCubic(mid, p123, p23, p3, tolerance, depth + 1, out);
}

type CubicControls = [Point, Point, Point, Point];

/**
 * Converts an SVG elliptical arc to cubic Béziers of at most 90° each, using the
 * endpoint-to-center conversion from the SVG 1.1 implementation notes (F.6.5, including the
 * out-of-range radii correction in F.6.6).
 */
function arcToCubics(
  from: Point,
  arc: Extract<Segment, { kind: "arc" }>,
): CubicControls[] {
  const to = arc.to;
  if (from.x === to.x && from.y === to.y) return [];
  let { rx, ry } = arc;
  if (rx === 0 || ry === 0) return [[from, from, to, to]];

  const phi = (arc.xAxisRotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const halfDx = (from.x - to.x) / 2;
  const halfDy = (from.y - to.y) / 2;
  const x1p = cosPhi * halfDx + sinPhi * halfDy;
  const y1p = -sinPhi * halfDx + cosPhi * halfDy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const numerator =
    rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const sign = arc.isLargeArc !== arc.isSweep ? 1 : -1;
  const coefficient = sign * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (coefficient * rx * y1p) / ry;
  const cyp = (-coefficient * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;

  const startAngle = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let sweepAngle = vectorAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (!arc.isSweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (arc.isSweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;

  const mapUnit = (ux: number, uy: number): Point => ({
    x: cx + cosPhi * rx * ux - sinPhi * ry * uy,
    y: cy + sinPhi * rx * ux + cosPhi * ry * uy,
  });

  const pieces = Math.max(
    1,
    Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2) - 1e-9),
  );
  const step = sweepAngle / pieces;
  const handle = (4 / 3) * Math.tan(step / 4);
  const cubics: CubicControls[] = [];
  let start = from;
  for (let index = 0; index < pieces; index++) {
    const angle1 = startAngle + index * step;
    const angle2 = angle1 + step;
    const cos1 = Math.cos(angle1);
    const sin1 = Math.sin(angle1);
    const cos2 = Math.cos(angle2);
    const sin2 = Math.sin(angle2);
    // Pin the final end point to the arc's own `to` so rounding never opens a gap.
    const end = index === pieces - 1 ? to : mapUnit(cos2, sin2);
    cubics.push([
      start,
      mapUnit(cos1 - handle * sin1, sin1 + handle * cos1),
      mapUnit(cos2 + handle * sin2, sin2 - handle * cos2),
      end,
    ]);
    start = end;
  }
  return cubics;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
