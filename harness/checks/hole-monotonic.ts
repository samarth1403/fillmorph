import type { Frame } from "../frames.ts";
import { formatNumber, polygonArea } from "../geometry.ts";
import { type CheckFailure, type CheckResult, checkResult } from "./check-result.ts";

/**
 * A hole whose area in some frame is at most this fraction of its largest area counts as reaching
 * a point there. 1e-4 of the area is 1% of the linear size, so a hole shrunk to a speck rather
 * than to an exact point still counts.
 */
const COLLAPSED_AREA_RATIO = 1e-4;

/** Area changes smaller than this fraction of the hole's largest area are treated as noise. */
const AREA_NOISE_RATIO = 1e-9;

/**
 * Spec 03 deliverable #5, non-monotonic hole closing. Holes are identified across frames **only
 * by `Contour.id`**, never by array position, proximity or area.
 *
 * - Frames are taken in **progress order** (sorted, stable), since monotonicity is about how the
 *   shape changes with progress; the order they were sampled or played in doesn't matter.
 *   Playback frames marked `isOnTarget` (drawn after their leg arrived) come after all the others,
 *   in progress order among themselves (spec 05's fourth reopen).
 * - A hole id present in some frame but missing (or no longer a hole) in another is a failure
 *   naming the id and the frame where it's missing — a hole vanishing between frames is itself a
 *   discontinuity. Such a hole's area isn't judged further. **One exception** (spec 03 #5, as
 *   reopened for spec 05's settle rule): a hole may *leave* the sequence — be missing from every
 *   frame after some point, in progress order, and never return — once it has fully collapsed,
 *   i.e. its area in the last frame it's present in is at most `COLLAPSED_AREA_RATIO` of its
 *   largest. That is what a settled morph does when it swaps the zero-area placeholder of a
 *   vanished hole for the exact target shape. Leaving before collapsing, reappearing after going
 *   missing, or being missing before first appearing all stay failures, and the frames where the
 *   hole is present are still judged for monotonicity below.
 *   **Also allowed** (added with spec 05's clamp reopen): leaving at a frame past progress 1, or
 *   at one marked `isOnTarget` (spec 05's fourth reopen draws those as the target too). Only
 *   an overshooting spring puts a frame there, and spec 05 draws such a frame as the leg's exact
 *   target (the shape is held on it), which interpolate's collapsed zero-area placeholder matches.
 *   A fast spring can jump from well short of 1 to past it in one frame, so no sampled frame shows
 *   the hole at ~0 first. The hole then counts as collapsed to area 0 at that frame, so its
 *   shrinking is still gated below.
 * - A hole that collapses to a point or grows from one (its area is ~0 in some frame) must change
 *   area monotonically across the whole sequence: shrinking if it reaches the point after its
 *   largest frame, growing if before. Each step that reverses direction is flagged with its
 *   progress range. This deliberately looks for ~0 anywhere, not just at the ends: a hole that
 *   collapses and then regrows (e.g. turned inside out by a spring overshooting past progress 1)
 *   is the defect this check exists for, and its last frame isn't ~0.
 * - A hole that never reaches a point isn't gated (spec 03 scopes the rule to collapsing/growing
 *   holes); a note records it.
 */
export function checkHoleMonotonic(frames: readonly Frame[]): CheckResult {
  const order = frames
    .map((frame, index) => ({ frame, index }))
    .sort(
      (a, b) =>
        Number(a.frame.isOnTarget === true) - Number(b.frame.isOnTarget === true) ||
        a.frame.progress - b.frame.progress,
    );

  const holeIds: string[] = [];
  for (const { frame } of order) {
    for (const contour of frame.contours) {
      if (contour.isHole && !holeIds.includes(contour.id)) holeIds.push(contour.id);
    }
  }

  const failures: CheckFailure[] = [];
  const notes: string[] = [];
  for (const id of holeIds) {
    const track: { area: number; index: number; frame: Frame }[] = [];
    const missing: { index: number; frame: Frame }[] = [];
    let isReturning = false;
    for (const { frame, index } of order) {
      const hole = frame.contours.find((contour) => contour.id === id && contour.isHole);
      if (hole === undefined) {
        missing.push({ index, frame });
        continue;
      }
      if (missing.length > 0) isReturning = true;
      track.push({ area: polygonArea(hole.points), index, frame });
    }

    const areas = track.map((entry) => entry.area);
    const largest = Math.max(0, ...areas);
    if (missing.length > 0) {
      const lastArea = areas[areas.length - 1] ?? Number.POSITIVE_INFINITY;
      const firstMissing = missing[0] as (typeof missing)[number];
      const hasLeftOnTarget =
        !isReturning &&
        track.length > 0 &&
        (firstMissing.frame.progress > 1 || firstMissing.frame.isOnTarget === true);
      const hasLeftCollapsed =
        hasLeftOnTarget ||
        (!isReturning && track.length > 0 && lastArea <= largest * COLLAPSED_AREA_RATIO);
      if (!hasLeftCollapsed) {
        const reason = isReturning
          ? "so it can't be tracked across the sequence"
          : "before it had collapsed to a point";
        for (const { index, frame } of missing) {
          failures.push({
            frameIndices: [index],
            contourId: id,
            message: `${frame.label}: hole ${id} is missing from this frame, ${reason}`,
          });
        }
        continue;
      }
      if (hasLeftOnTarget && lastArea > largest * COLLAPSED_AREA_RATIO) {
        track.push({ area: 0, index: firstMissing.index, frame: firstMissing.frame });
        areas.push(0);
        notes.push(
          `hole ${id} left the sequence past progress 1, held on the exact target, from ${firstMissing.frame.label}; counted as collapsed there`,
        );
      } else {
        notes.push(
          `hole ${id} collapsed to a point, then left the sequence from ${firstMissing.frame.label}`,
        );
      }
    }
    if (track.length < 2) continue;
    if (largest === 0) continue;
    const pointIndex = areas.findIndex((area) => area <= largest * COLLAPSED_AREA_RATIO);
    if (pointIndex === -1) {
      notes.push(`hole ${id} neither collapses to nor grows from a point; its area isn't gated`);
      continue;
    }

    const isCollapsing = pointIndex > areas.indexOf(largest);
    const direction = isCollapsing ? -1 : 1;
    const noise = largest * AREA_NOISE_RATIO;
    for (let step = 1; step < track.length; step++) {
      const before = track[step - 1] as (typeof track)[number];
      const after = track[step] as (typeof track)[number];
      if ((after.area - before.area) * direction < -noise) {
        failures.push({
          frameIndices: [before.index, after.index],
          contourId: id,
          message:
            `hole ${id} is ${isCollapsing ? "collapsing to" : "growing from"} a point but its area ` +
            `${direction < 0 ? "grows" : "shrinks"} from ${formatNumber(before.area)} to ` +
            `${formatNumber(after.area)} between ${before.frame.label} and ${after.frame.label}`,
        });
      }
    }
  }
  return checkResult("hole-monotonic", failures, notes);
}
