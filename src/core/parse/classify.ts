import type { Point } from "../contour";
import { type Bounds, boundsOf, distanceToOutline, isPointInPolygon, signedArea } from "./geometry";

/** Where one polygon sits in the containment tree. */
export type Nesting = {
  /** Number of other polygons this one sits inside: 0 = outer shape, 1 = hole, 2 = inner shape. */
  depth: number;
  /** Index of the innermost polygon containing this one, or `null` at depth 0. */
  parentIndex: number | null;
};

/**
 * Computes each closed polygon's place in the containment tree: its depth (how many other
 * polygons contain it) and its parent (the innermost of those, i.e. the smallest by area).
 * Depth 0 is an outer shape, 1 a hole in it, 2 a shape inside that hole, and so on by parity.
 * Siblings at the same depth (e.g. the two holes of a "B") share a parent and don't affect each
 * other. For properly nested polygons the containers form a chain, so the parent's depth is
 * always exactly one less than the child's.
 *
 * `boundaryTolerance` absorbs curve-flattening error: vertices of the inner polygon that lie
 * within it of the outer polygon's outline (a hole touching its outer shape) are neither counted
 * as inside nor as outside. Polygons must be non-self-intersecting and must not cross each other;
 * partially overlapping polygons are treated as not nested.
 *
 * This is containment only, as spec 02 locks it — winding and fill-rule are not consulted. So a
 * nested contour authored with the *same* winding as its container under `fill-rule="nonzero"`
 * (which browsers draw filled, not as a hole) is still classified as a hole here. A known
 * limitation of containment-only classification, not a bug.
 */
export function classifyNesting(
  polygons: readonly (readonly Point[])[],
  boundaryTolerance: number,
): Nesting[] {
  const areas = polygons.map((polygon) => Math.abs(signedArea(polygon)));
  const bounds = polygons.map(boundsOf);
  return polygons.map((inner, innerIndex) => {
    let depth = 0;
    let parentIndex: number | null = null;
    polygons.forEach((outer, outerIndex) => {
      const outerArea = areas[outerIndex] as number;
      if (
        outerIndex !== innerIndex &&
        outerArea > (areas[innerIndex] as number) &&
        isBoundsWithin(
          bounds[innerIndex] as Bounds,
          bounds[outerIndex] as Bounds,
          boundaryTolerance,
        ) &&
        isPolygonInside(inner, outer, boundaryTolerance)
      ) {
        depth++;
        // Strict `<` keeps the lowest index on an exact area tie, so the choice is deterministic.
        if (parentIndex === null || outerArea < (areas[parentIndex] as number)) {
          parentIndex = outerIndex;
        }
      }
    });
    return { depth, parentIndex };
  });
}

function isPolygonInside(
  inner: readonly Point[],
  outer: readonly Point[],
  boundaryTolerance: number,
): boolean {
  let hasDecidingVertex = false;
  for (const point of inner) {
    if (distanceToOutline(point, outer) <= boundaryTolerance) continue;
    if (!isPointInPolygon(point, outer)) return false;
    hasDecidingVertex = true;
  }
  return hasDecidingVertex;
}

function isBoundsWithin(inner: Bounds, outer: Bounds, tolerance: number): boolean {
  return (
    inner.minX >= outer.minX - tolerance &&
    inner.minY >= outer.minY - tolerance &&
    inner.maxX <= outer.maxX + tolerance &&
    inner.maxY <= outer.maxY + tolerance
  );
}
