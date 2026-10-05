import type { Point } from "../contour";
import { type Bounds, boundsOf, distanceToOutline, isPointInPolygon, signedArea } from "./geometry";
import type { FillRule } from "./markup";

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
 * Siblings at the same depth (e.g. the two holes of a "B") share a parent and don't affect each
 * other. For properly nested polygons the containers form a chain, so the parent's depth is
 * always exactly one less than the child's.
 *
 * `boundaryTolerance` absorbs curve-flattening error: vertices of the inner polygon that lie
 * within it of the outer polygon's outline (a hole touching its outer shape) are neither counted
 * as inside nor as outside. Polygons must be non-self-intersecting and must not cross each other;
 * partially overlapping polygons are treated as not nested.
 *
 * This is containment only: winding and fill-rule aren't consulted. `classifyFill` decides, on
 * top of it, which polygons are holes.
 */
export function classifyNesting(
  polygons: readonly (readonly Point[])[],
  boundaryTolerance: number,
): Nesting[] {
  const areas = polygons.map((polygon) => Math.abs(signedArea(polygon)));
  return containersOf(polygons, boundaryTolerance).map((containers) => ({
    depth: containers.length,
    parentIndex: smallest(containers, areas),
  }));
}

/** One `<path>`'s closed polygons, in the path's own source winding, and its `fill-rule`. */
export type PathPolygons = {
  polygons: readonly (readonly Point[])[];
  fillRule: FillRule;
};

/** A polygon that bounds filled area: its place in the hole-classified tree. */
export type FillNesting = {
  isHole: boolean;
  /** Depth among kept polygons only: 0 = outer shape, 1 = hole, 2 = shape inside the hole, … */
  depth: number;
  /** Flat index (across all paths, in order) of the kept polygon directly around this one. */
  parentIndex: number | null;
};

/**
 * Decides, the way a browser fills, which polygons are holes and which bound nothing at all, for
 * every `<path>` of an icon (spec 11). Returns one entry per polygon, flattened across `paths` in
 * order: a `FillNesting`, or `null` for a polygon that changes nothing (the fill is the same on
 * both sides of it, so dropping it draws the same shape).
 *
 * Within one path, from the fill just outside and just inside each polygon:
 * - **`nonzero`:** the winding number, the sum of the source windings (+1 or -1, by signed area)
 *   of every polygon around the point. A polygon is an outer shape where it goes from zero to
 *   non-zero, a hole where it goes back to zero, and nothing where it stays non-zero. So a nested
 *   subpath wound the same way as its container is filled, not a hole.
 * - **`evenodd`:** the count of polygons around the point, filled when odd: every nesting level
 *   alternates.
 *
 * Polygons that trace the same outline (an exporter writing a subpath twice, possibly in opposite
 * directions) are counted together - for `nonzero` their windings can cancel - and at most one of
 * them is kept. "The same outline" means every vertex of each lies within twice
 * `boundaryTolerance` of the other's outline, since each copy is only within the tolerance of the
 * true curve.
 *
 * **Across paths, nothing ever becomes a hole:** separate `<path>` elements draw on top of each
 * other, a union, so each path is classified alone. A path's outer shape that sits inside another
 * path's *hole* (a dot drawn as its own path inside a ring) is still linked into that hole as an
 * island, since that's the structure it has on screen; one that sits on another path's *filled*
 * area stays a separate outer shape.
 *
 * `boundaryTolerance` is `classifyNesting`'s.
 */
export function classifyFill(
  paths: readonly PathPolygons[],
  boundaryTolerance: number,
): (FillNesting | null)[] {
  const polygons = paths.flatMap((path) => path.polygons);
  const areas = polygons.map((polygon) => Math.abs(signedArea(polygon)));
  const pathOf: number[] = [];
  const kept: (Omit<FillNesting, "depth"> | null)[] = [];

  paths.forEach(({ polygons: own, fillRule }, pathIndex) => {
    const offset = kept.length;
    const containers = containersOf(own, boundaryTolerance);
    const groupOf = groupCoincident(own, boundaryTolerance);
    const winding = own.map((polygon) => Math.sign(signedArea(polygon)));
    // One polygon's contribution to the fill test: its winding, or 1 to count it for evenodd.
    const weight = (index: number): number =>
      fillRule === "evenodd" ? 1 : (winding[index] as number);
    const isFilled = (sum: number): boolean => (fillRule === "evenodd" ? sum % 2 !== 0 : sum !== 0);

    const isBoundary: boolean[] = [];
    const isFilledInside: boolean[] = [];
    own.forEach((_, index) => {
      const group = groupOf[index] as number[];
      const around = (containers[index] as number[])
        .filter((container) => !group.includes(container))
        .reduce((sum, container) => sum + weight(container), 0);
      const inside = around + group.reduce((sum, member) => sum + weight(member), 0);
      isFilledInside.push(isFilled(inside));
      // Only the group's first polygon can be kept; the rest repeat its outline.
      isBoundary.push(group[0] === index && isFilled(inside) !== isFilled(around));
    });

    own.forEach((_, index) => {
      pathOf.push(pathIndex);
      if (!isBoundary[index]) {
        kept.push(null);
        return;
      }
      // Dropped polygons don't change the fill, so the innermost kept container is the parent.
      const parent = smallest(
        (containers[index] as number[]).filter((container) => isBoundary[container]),
        areas.slice(offset),
      );
      kept.push({
        isHole: !isFilledInside[index],
        parentIndex: parent === null ? null : offset + parent,
      });
    });
  });

  // Islands: a path's outer shape whose innermost container among every other kept polygon is
  // another path's hole.
  const keptIndices = kept.flatMap((entry, index) => (entry === null ? [] : [index]));
  const global = classifyNesting(
    keptIndices.map((index) => polygons[index] as Point[]),
    boundaryTolerance,
  );
  keptIndices.forEach((index, position) => {
    const entry = kept[index];
    const container = global[position]?.parentIndex;
    if (entry == null || entry.parentIndex !== null || container == null) return;
    const containerIndex = keptIndices[container] as number;
    if (pathOf[containerIndex] !== pathOf[index] && kept[containerIndex]?.isHole) {
      entry.parentIndex = containerIndex;
    }
  });

  const depths = new Map<number, number>();
  const depthOf = (index: number): number => {
    let depth = depths.get(index);
    if (depth === undefined) {
      const parent = kept[index]?.parentIndex ?? null;
      depth = parent === null ? 0 : depthOf(parent) + 1;
      depths.set(index, depth);
    }
    return depth;
  };
  return kept.map((entry, index) => (entry === null ? null : { ...entry, depth: depthOf(index) }));
}

/** For each polygon, the indices of every other polygon that contains it. */
function containersOf(
  polygons: readonly (readonly Point[])[],
  boundaryTolerance: number,
): number[][] {
  const areas = polygons.map((polygon) => Math.abs(signedArea(polygon)));
  const bounds = polygons.map(boundsOf);
  return polygons.map((inner, innerIndex) =>
    polygons.flatMap((outer, outerIndex) =>
      outerIndex !== innerIndex &&
      (areas[outerIndex] as number) > (areas[innerIndex] as number) &&
      isBoundsWithin(
        bounds[innerIndex] as Bounds,
        bounds[outerIndex] as Bounds,
        boundaryTolerance,
      ) &&
      isPolygonInside(inner, outer, boundaryTolerance)
        ? [outerIndex]
        : [],
    ),
  );
}

/** The smallest-area index among `indices` (lowest index on an exact tie), or `null` if none. */
function smallest(indices: readonly number[], areas: readonly number[]): number | null {
  let best: number | null = null;
  for (const index of indices) {
    if (best === null || (areas[index] as number) < (areas[best] as number)) best = index;
  }
  return best;
}

/** For each polygon, every polygon (itself included, in index order) tracing the same outline. */
function groupCoincident(
  polygons: readonly (readonly Point[])[],
  boundaryTolerance: number,
): number[][] {
  const tolerance = 2 * boundaryTolerance;
  const bounds = polygons.map(boundsOf);
  return polygons.map((polygon, index) =>
    polygons.flatMap((other, otherIndex) =>
      otherIndex === index ||
      (isBoundsWithin(bounds[index] as Bounds, bounds[otherIndex] as Bounds, tolerance) &&
        isBoundsWithin(bounds[otherIndex] as Bounds, bounds[index] as Bounds, tolerance) &&
        isOnOutline(polygon, other, tolerance) &&
        isOnOutline(other, polygon, tolerance))
        ? [otherIndex]
        : [],
    ),
  );
}

function isOnOutline(
  points: readonly Point[],
  outline: readonly Point[],
  tolerance: number,
): boolean {
  return points.every((point) => distanceToOutline(point, outline) <= tolerance);
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
