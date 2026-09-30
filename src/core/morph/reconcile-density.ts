/**
 * Fewest points the rotation search samples each contour at. Spec 02's adaptive flattening can
 * leave a straight-edged contour with only a handful of points; comparing its shape against a
 * curve needs more samples than its own corners.
 */
export const MIN_SHARED_POINT_COUNT = 16;

/**
 * Most points the rotation search samples each contour at. It bounds the O(N²) search (spec 04
 * #4), which runs on every `interpolate` call. Well above any parsed fixture contour (87 points at
 * most), but a mid-flight snapshot carries both of its leg's outlines' vertices (spec 07), so
 * retargeting again and again without settling grows it by about 70 points a time. Lowered from
 * 1024 in spec 07: 30 such retargets in a row measured 6 ms per call at 12 with 1024, and plateau
 * near 2 ms at 256. A 1/256-of-the-perimeter step is still far finer than the alignment needs.
 */
export const MAX_SHARED_POINT_COUNT = 256;

/**
 * Spec 04 deliverable #3's shared point count for a matched pair: whichever side has more detail,
 * clamped to `MIN_SHARED_POINT_COUNT`…`MAX_SHARED_POINT_COUNT`. Since spec 07 it sets the
 * resolution of the rotation search (both contours sampled evenly by arc length at this count),
 * not the output point count; see `pairByArcLength`.
 */
export function sharedPointCount(fromCount: number, toCount: number): number {
  return Math.min(MAX_SHARED_POINT_COUNT, Math.max(MIN_SHARED_POINT_COUNT, fromCount, toCount));
}
