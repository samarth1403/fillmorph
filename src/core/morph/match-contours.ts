import type { Contour, Point } from "../contour";
import { centroidOf } from "./centroid";

/** A `from` contour and the `to` contour it morphs into. */
export type MatchedPair = { from: Contour; to: Contour };

/**
 * Spec 04 deliverable #1's result. Every input contour lands in exactly one of the three lists.
 * The unmatched ones are handed to deliverable #2, which gives each a collapsed partner.
 */
export type StructuralMatch = {
  matched: MatchedPair[];
  /** `from` contours with no `to` partner: they disappear. In `from`'s array order. */
  unmatchedFrom: Contour[];
  /** `to` contours with no `from` partner: they appear. In `to`'s array order. */
  unmatchedTo: Contour[];
};

/**
 * Matches `from`'s contours to `to`'s structurally (spec 04 deliverable #1).
 *
 * Contours are grouped by parent: the depth-0 contours form one group, and the children of any
 * contour form another. Matching works down the tree. The two root groups are matched first. Then
 * for every matched pair, the `from` contour's children are matched to the `to` contour's
 * children. Within each group, both sides are sorted by area centroid (x, then y, then array
 * order, so the result is deterministic) and paired by index. The extras on the longer side are
 * unmatched, and so is every descendant of an unmatched contour, since it has no parent partner
 * whose children it could match.
 *
 * Expects each side to be one coherent tree, as `parseIcon` and `interpolate` produce: unique
 * `id`s, and every `parentId` naming a contour on the same side. Throws `TypeError` otherwise,
 * rather than silently dropping the contours it can't place.
 */
export function matchContours(from: readonly Contour[], to: readonly Contour[]): StructuralMatch {
  const fromTree = indexTree(from, "from");
  const toTree = indexTree(to, "to");
  const matched: MatchedPair[] = [];
  const unmatchedFromIds = new Set<string>();
  const unmatchedToIds = new Set<string>();

  const matchGroup = (fromGroup: readonly Contour[], toGroup: readonly Contour[]): void => {
    const fromSorted = sortByCentroid(fromGroup);
    const toSorted = sortByCentroid(toGroup);
    const pairCount = Math.min(fromSorted.length, toSorted.length);
    for (let index = 0; index < pairCount; index++) {
      const pair = { from: fromSorted[index] as Contour, to: toSorted[index] as Contour };
      matched.push(pair);
      matchGroup(fromTree.childrenOf(pair.from.id), toTree.childrenOf(pair.to.id));
    }
    for (const contour of fromSorted.slice(pairCount)) {
      for (const lost of fromTree.subtreeOf(contour)) unmatchedFromIds.add(lost.id);
    }
    for (const contour of toSorted.slice(pairCount)) {
      for (const added of toTree.subtreeOf(contour)) unmatchedToIds.add(added.id);
    }
  };
  matchGroup(fromTree.childrenOf(null), toTree.childrenOf(null));

  return {
    matched,
    unmatchedFrom: from.filter((contour) => unmatchedFromIds.has(contour.id)),
    unmatchedTo: to.filter((contour) => unmatchedToIds.has(contour.id)),
  };
}

type ContourTree = {
  /** Children of the contour with this id, or the depth-0 contours for `null`, in array order. */
  childrenOf: (id: string | null) => Contour[];
  /** The contour itself plus all of its descendants. */
  subtreeOf: (contour: Contour) => Contour[];
};

function indexTree(contours: readonly Contour[], side: "from" | "to"): ContourTree {
  const ids = new Set<string>();
  for (const contour of contours) {
    if (ids.has(contour.id)) {
      throw new TypeError(
        `interpolate: two \`${side}\` contours share the id "${contour.id}". Pass contours as ` +
          "parseIcon or interpolate returns them, with unique ids.",
      );
    }
    ids.add(contour.id);
    if (contour.points.length === 0) {
      throw new TypeError(`interpolate: \`${side}\` contour "${contour.id}" has no points.`);
    }
  }

  const children = new Map<string | null, Contour[]>();
  for (const contour of contours) {
    if (contour.parentId !== null && !ids.has(contour.parentId)) {
      throw new TypeError(
        `interpolate: \`${side}\` contour "${contour.id}" names parent "${contour.parentId}", ` +
          "which isn't in the same array.",
      );
    }
    const siblings = children.get(contour.parentId) ?? [];
    siblings.push(contour);
    children.set(contour.parentId, siblings);
  }

  const childrenOf = (id: string | null): Contour[] => children.get(id) ?? [];
  const subtreeOf = (contour: Contour): Contour[] => [
    contour,
    ...childrenOf(contour.id).flatMap(subtreeOf),
  ];

  // Every contour must hang off a depth-0 root; one that doesn't (a parentId cycle) would
  // otherwise never be visited and silently vanish from the output.
  const reachable = childrenOf(null).flatMap(subtreeOf).length;
  if (reachable !== contours.length) {
    throw new TypeError(
      `interpolate: \`${side}\` contains contours whose parentId chain never reaches a ` +
        "depth-0 contour (parentId null).",
    );
  }
  return { childrenOf, subtreeOf };
}

function sortByCentroid(group: readonly Contour[]): Contour[] {
  const keyed = group.map((contour) => ({ contour, centroid: centroidOf(contour.points) }));
  // Array.prototype.sort is stable, so exact centroid ties keep array order.
  keyed.sort((a, b) => compareCentroids(a.centroid, b.centroid));
  return keyed.map((entry) => entry.contour);
}

function compareCentroids(a: Point, b: Point): number {
  return a.x - b.x || a.y - b.y;
}
