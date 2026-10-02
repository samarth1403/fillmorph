import type { Contour } from "fillmorph";
import type { CheckFailure, CheckResult } from "../checks/check-result.ts";
import { checkResult } from "../checks/check-result.ts";
import { formatNumber } from "../geometry.ts";
import { arrivedFlags, poppedTarget } from "./overshoot-rule.ts";
import type { PlaybackTrace } from "./runner.ts";

/** Canonical units: well under the 3-decimal rounding `renderContours` draws with. */
const TOLERANCE = 1e-6;

/** The largest distance between matching points, or null if the two don't share a structure. */
function deviation(drawn: readonly Contour[], expected: readonly Contour[]): number | null {
  if (drawn.length !== expected.length) return null;
  let largest = 0;
  for (const [index, contour] of drawn.entries()) {
    const other = expected[index] as Contour;
    if (contour.id !== other.id || contour.points.length !== other.points.length) return null;
    for (const [pointIndex, point] of contour.points.entries()) {
      const target = other.points[pointIndex] as { x: number; y: number };
      largest = Math.max(largest, Math.hypot(point.x - target.x, point.y - target.y));
    }
  }
  return largest;
}

/**
 * Deliverable #7's arrived-shape check (added with spec 05's fourth reopen): once a leg has
 * arrived (its spring first reached position 1), every later frame of that leg must be the leg's
 * target itself, scaled by spec 05's overshoot rule (`poppedTarget`), with no trace of the leg's
 * `from` left. An underdamped spring swings back below 1 after arriving; drawing those frames by
 * interpolating again would slide the shape back toward `from` mid-bounce, which is the defect
 * this check exists for. A settled frame is the target at scale 1.
 */
export function checkArrivedShape(trace: PlaybackTrace): CheckResult {
  const failures: CheckFailure[] = [];
  const notes: string[] = [];
  const isArrived = arrivedFlags(trace.entries);
  const arrivedLegs = new Set<number>();
  for (const [index, entry] of trace.entries.entries()) {
    if (!isArrived[index]) continue;
    arrivedLegs.add(entry.leg);
    const leg = trace.legs[entry.leg];
    if (leg === undefined) continue;
    const expected = poppedTarget(leg.to, entry.position);
    const off = deviation(entry.contours, expected);
    if (off === null || off > TOLERANCE) {
      failures.push({
        frameIndices: [index],
        contourId: null,
        message:
          `t=${formatNumber(entry.time)}s p=${formatNumber(entry.position)} (leg ${entry.leg + 1}): ` +
          (off === null
            ? "after the leg arrived, the shape no longer has its target's structure"
            : `after the leg arrived, the shape is off its (scaled) target by ${formatNumber(off)} units`),
      });
    }
  }
  if (arrivedLegs.size === 0) notes.push("no leg reached position 1 before settling");
  return checkResult("arrived-shape", failures, notes);
}
