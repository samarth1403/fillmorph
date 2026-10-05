import type { Contour, Point } from "../contour";
import { centroidOf } from "./centroid";
import { matchContours } from "./match-contours";
import { pairByArcLength } from "./pair-by-arc-length";
import { collapsedPartner } from "./placeholder";

/**
 * Where an unmatched contour collapses to (or grows from), when that point has to move with the
 * morph: the live centroid of the output contour `ancestorId`, recomputed at every progress value.
 * `placeholderSide` says which of `fromPoints`/`toPoints` is the synthesized point contour that
 * the live centroid replaces.
 */
export type CollapseAnchor = { placeholderSide: "from" | "to"; ancestorId: string };

/**
 * One output contour's full correspondence: structure plus two point arrays of equal length,
 * paired by index. Everything here is independent of progress; an `anchor` says where progress
 * moves a placeholder side.
 */
export type ContourCorrespondence = {
  id: string;
  parentId: string | null;
  isHole: boolean;
  depth: number;
  fromPoints: Point[];
  toPoints: Point[];
  /** The contour's `opacity` (1 when absent) at each end: a matched pair's two, else its own. */
  fromOpacity: number;
  toOpacity: number;
  /**
   * Set on an unmatched contour that has an ancestor with a partner; `null` on matched contours
   * and on unmatched ones with no partnered ancestor, whose placeholder stays at their own fixed
   * centroid.
   */
  anchor: CollapseAnchor | null;
};

/**
 * Runs spec 04 deliverables #1–#4 on two contour trees: match structure, give unmatched contours
 * a collapsed partner, then pair each pair's points by arc-length position after aligning
 * rotation (spec 07, which replaced #4's index pairing; see `pairByArcLength`).
 *
 * The output tree (`id`/`parentId`/`isHole`/`depth`) is `to`'s own tree, plus the contours that
 * disappear:
 * - a `to` contour, matched or appearing, keeps its `id`, `parentId`, `isHole` and `depth`;
 * - a disappearing `from` contour keeps its structure too, with its `id` kept if no `to` contour
 *   uses it (suffixed `~1`, `~2`, … otherwise) and its `parentId` translated to its parent's
 *   output `id`.
 *
 * Ids therefore don't depend on progress, so a hole is the same `id` in every frame of one morph.
 * Order: `to`'s contours in `to`'s order, then the disappearing ones in `from`'s order.
 *
 * Each unmatched contour is anchored to its nearest ancestor that has a partner, walking past
 * unmatched parents (deliverable #2); see `CollapseAnchor`. Its placeholder arrays hold its own
 * centroid, which is what it collapses to when no such ancestor exists; being a single point
 * repeated, it has no perimeter, so the rotation search picks k = 0 and its partner's vertices set
 * the pair's points either way.
 */
export function correspondContours(
  from: readonly Contour[],
  to: readonly Contour[],
): ContourCorrespondence[] {
  const { matched, unmatchedFrom } = matchContours(from, to);
  const partnerOfTo = new Map(matched.map((pair) => [pair.to.id, pair.from]));

  const outputIdOfFrom = new Map(matched.map((pair) => [pair.from.id, pair.to.id]));
  const usedIds = new Set(to.map((contour) => contour.id));
  for (const contour of unmatchedFrom) {
    let id = contour.id;
    for (let suffix = 1; usedIds.has(id); suffix++) id = `${contour.id}~${suffix}`;
    usedIds.add(id);
    outputIdOfFrom.set(contour.id, id);
  }

  const toById = new Map(to.map((contour) => [contour.id, contour]));
  const fromById = new Map(from.map((contour) => [contour.id, contour]));
  const matchedFromIds = new Set(matched.map((pair) => pair.from.id));

  const appearingOrMatched = to.map((target) => {
    const partner = partnerOfTo.get(target.id);
    if (partner !== undefined) {
      return correspond(target, target.id, target.parentId, partner.points, target.points, null, {
        from: opacityOf(partner),
        to: opacityOf(target),
      });
    }
    // A matched `to` ancestor's output id is its own id.
    const ancestor = nearestPartneredAncestor(target, toById, (id) => partnerOfTo.has(id));
    return correspond(
      target,
      target.id,
      target.parentId,
      collapsedPartner(target.points),
      target.points,
      ancestor === null ? null : { placeholderSide: "from", ancestorId: ancestor.id },
    );
  });
  const disappearing = unmatchedFrom.map((source) => {
    const ancestor = nearestPartneredAncestor(source, fromById, (id) => matchedFromIds.has(id));
    return correspond(
      source,
      outputIdOfFrom.get(source.id) as string,
      source.parentId === null ? null : (outputIdOfFrom.get(source.parentId) as string),
      source.points,
      collapsedPartner(source.points),
      ancestor === null
        ? null
        : { placeholderSide: "to", ancestorId: outputIdOfFrom.get(ancestor.id) as string },
    );
  });
  return [...appearingOrMatched, ...disappearing];
}

/** Walks up `contour`'s parent chain (on its own side) to the first ancestor with a partner. */
function nearestPartneredAncestor(
  contour: Contour,
  byId: ReadonlyMap<string, Contour>,
  hasPartner: (id: string) => boolean,
): Contour | null {
  let current = contour.parentId === null ? undefined : byId.get(contour.parentId);
  while (current !== undefined) {
    if (hasPartner(current.id)) return current;
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return null;
}

function correspond(
  structure: Contour,
  id: string,
  parentId: string | null,
  fromPoints: readonly Point[],
  toPoints: readonly Point[],
  anchor: CollapseAnchor | null,
  opacity = { from: opacityOf(structure), to: opacityOf(structure) },
): ContourCorrespondence {
  return {
    id,
    parentId,
    isHole: structure.isHole,
    depth: structure.depth,
    ...pairByArcLength(fromPoints, toPoints),
    fromOpacity: opacity.from,
    toOpacity: opacity.to,
    anchor,
  };
}

function opacityOf(contour: Contour): number {
  return contour.opacity ?? 1;
}

function lerp(a: number, b: number, t: number): number {
  // Exactly `a` at t = 0 and exactly `b` at t = 1, which `a + (b - a) * t` doesn't guarantee in
  // floating point.
  return a * (1 - t) + b * t;
}

function lerpPoints(from: readonly Point[], to: readonly Point[], t: number): Point[] {
  return from.map((start, index) => {
    const end = to[index] as Point;
    return { x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t) };
  });
}

/**
 * The geometry of a morph from `from` to `to` at `progress`: 0 is `from`, 1 is `to`. This is the
 * real implementation of spec 03's `MorphFn` interface (spec 04 deliverable #6).
 *
 * Internally (spec 04 deliverables #1–#5, with spec 07's pairing): contours are matched by
 * structure (parent and centroid order); a contour with no partner collapses to, or grows from, a
 * point; the pair's rotation is aligned to minimize point travel; points are paired by arc-length
 * position around each outline; then every point is interpolated linearly. See `correspondContours` for the output tree's
 * `id`/`parentId` rule: it's `to`'s tree plus the disappearing contours, and the same for every
 * progress value.
 *
 * The point an unmatched contour collapses to or grows from is the **live area centroid of its
 * nearest ancestor that has a partner**, i.e. of that ancestor's interpolated outline at this
 * same `progress`, so the contour stays with the geometry it belongs to while that geometry
 * moves. A chain of unmatched contours (e.g. a hole and the dot inside it) all track the same
 * ancestor and collapse together. With no partnered ancestor at all, the point is the contour's
 * own fixed centroid.
 *
 * - **Inputs** are canonical-frame contour trees as `parseIcon` returns them, or a previous
 *   `interpolate` output (e.g. a mid-flight snapshot). Each side needs unique `id`s and every
 *   `parentId` naming a contour on the same side; otherwise it throws `TypeError`.
 * - **Progress** must be finite, or it throws `RangeError`. Values outside 0…1 extrapolate
 *   linearly, which a spring overshoot relies on. A collapsing contour extrapolated past 1 turns
 *   through its collapse point and regrows mirrored, so callers that overshoot should expect that.
 * - **Output:** at progress 0 and 1 every contour's outline is exactly the input one: each input
 *   vertex is present at its exact position, in order (a `to` contour may start at a different
 *   index), and extra points lie on its edges. Disappearing contours are
 *   still present as zero-area point contours, so a hole's id never vanishes mid-sequence.
 * - **Opacity** (spec 11): a matched contour's `opacity` fades linearly between its two ends,
 *   clamped to 0…1; an appearing or disappearing one keeps its own. Fully opaque contours carry no
 *   `opacity` field, as in `parseIcon`'s output.
 */
export function interpolate(from: Contour[], to: Contour[], progress: number): Contour[] {
  if (!Number.isFinite(progress)) {
    throw new RangeError(`interpolate: progress must be a finite number, got ${progress}.`);
  }
  const pairs = correspondContours(from, to);

  // Anchors are always matched contours, which don't depend on any other contour, so one pass
  // over them gives every anchor's live shape before any anchored contour needs it.
  const livePoints = new Map<string, Point[]>();
  for (const pair of pairs) {
    if (pair.anchor === null) {
      livePoints.set(pair.id, lerpPoints(pair.fromPoints, pair.toPoints, progress));
    }
  }
  const liveCentroids = new Map<string, Point>();
  const liveCentroidOf = (id: string): Point => {
    let centroid = liveCentroids.get(id);
    if (centroid === undefined) {
      centroid = centroidOf(livePoints.get(id) as Point[]);
      liveCentroids.set(id, centroid);
    }
    return centroid;
  };

  return pairs.map((pair) => {
    let points = livePoints.get(pair.id);
    if (pair.anchor !== null) {
      const target = liveCentroidOf(pair.anchor.ancestorId);
      const real = pair.anchor.placeholderSide === "from" ? pair.toPoints : pair.fromPoints;
      const collapsed = real.map(() => target);
      points =
        pair.anchor.placeholderSide === "from"
          ? lerpPoints(collapsed, pair.toPoints, progress)
          : lerpPoints(pair.fromPoints, collapsed, progress);
    }
    const contour: Contour = {
      id: pair.id,
      parentId: pair.parentId,
      isHole: pair.isHole,
      depth: pair.depth,
      points: points as Point[],
    };
    // Clamped, since a spring's overshoot extrapolates progress past 0…1.
    const opacity = Math.min(1, Math.max(0, lerp(pair.fromOpacity, pair.toOpacity, progress)));
    return opacity === 1 ? contour : { ...contour, opacity };
  });
}
