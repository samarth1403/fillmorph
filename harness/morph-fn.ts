import type { Contour, Point } from "fillmorph";

/**
 * The interface the harness grades (spec 03 deliverable #2): the geometry of a morph from `from`
 * to `to` at `progress` (0 = `from`, 1 = `to`). Spec 04's `interpolate` is the real
 * implementation; until it exists the harness runs `naiveMorph`.
 */
export type MorphFn = (from: Contour[], to: Contour[], progress: number) => Contour[];

function lerp(a: number, b: number, t: number): number {
  // This form returns exactly `a` at t = 0 and exactly `b` at t = 1, which `a + (b - a) * t`
  // doesn't guarantee in floating point.
  return a * (1 - t) + b * t;
}

/**
 * A deliberately naive placeholder `MorphFn`, known to look bad; it exists only to prove the
 * harness's rendering and checks work on *some* input. Rules (spec 03 deliverable #2):
 *
 * - **Structure comes from `to`, unchanged:** one output contour per `to` contour, in `to`'s
 *   order, each carrying that contour's `id`, `parentId`, `isHole` and `depth` together. The
 *   output tree is always `to`'s valid tree, stable across frames, and equals `to` at progress 1.
 * - **Points pair by array index:** for `to[i]`'s point `j` (of `nTo`), take
 *   `from[i].points[floor(j × nFrom / nTo)]` and lerp it toward `to[i].points[j]`.
 * - A `to` contour with no `from[i]` partner (or a partner with no points) lerps from its own
 *   points, so it doesn't move. `from` contours beyond `to.length` are dropped.
 *
 * At progress 0 the output doesn't reproduce `from` when counts differ; that's accepted for a
 * placeholder. These rules bind only this stub, not spec 04.
 */
export const naiveMorph: MorphFn = (from, to, progress) =>
  to.map((target, index) => {
    const partnerPoints = from[index]?.points ?? [];
    const sourcePoints = partnerPoints.length > 0 ? partnerPoints : target.points;
    const points = target.points.map((end, pointIndex): Point => {
      const sourceIndex = Math.floor((pointIndex * sourcePoints.length) / target.points.length);
      const start = sourcePoints[sourceIndex] as Point;
      return { x: lerp(start.x, end.x, progress), y: lerp(start.y, end.y, progress) };
    });
    return {
      id: target.id,
      parentId: target.parentId,
      isHole: target.isHole,
      depth: target.depth,
      points,
    };
  });
