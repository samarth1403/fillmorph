import type { CheckFailure, CheckResult } from "../checks/check-result.ts";
import { checkResult } from "../checks/check-result.ts";
import { checkContainment } from "../checks/containment.ts";
import { checkHoleMonotonic } from "../checks/hole-monotonic.ts";
import { checkSelfIntersection } from "../checks/self-intersection.ts";
import type { Frame } from "../frames.ts";
import { formatNumber } from "../geometry.ts";
import { arrivedFlags } from "./overshoot-rule.ts";
import type { PlaybackTrace } from "./runner.ts";

/** Every trace entry as a checkable frame, labeled with its time, position and leg. */
export function traceFrames(trace: PlaybackTrace): Frame[] {
  const isArrived = arrivedFlags(trace.entries);
  return trace.entries.map((entry, index) => ({
    progress: entry.position,
    contours: entry.contours,
    label: `t=${formatNumber(entry.time)}s p=${formatNumber(entry.position)} (leg ${entry.leg + 1})`,
    isOnTarget: isArrived[index] === true,
  }));
}

/**
 * Deliverable #7 reuses deliverable #5's geometry checks on **every** frame of a trace, not just
 * static checkpoints. Self-intersection and containment are per frame.
 *
 * Hole monotonicity is judged per leg, because each leg is a different morph with its own contour
 * ids, and only over the **morph**: the leg's frames before it arrived (its spring first reached
 * 1), taken in progress order, then the leg's exact target as the final frame. After arrival spec
 * 05 draws the target uniformly scaled by the bounce, which `checkArrivedShape` grades exactly; a
 * uniform scale shrinks a hole along with everything else on an undershoot, which isn't the hole
 * pulsing this check is for (spec 05's fourth reopen).
 */
export function checkTraceGeometry(trace: PlaybackTrace): CheckResult[] {
  const frames = traceFrames(trace);
  const failures: CheckFailure[] = [];
  const notes: string[] = [];
  for (const leg of trace.legs) {
    const indices = trace.entries.flatMap((entry, index) =>
      entry.leg === leg.index ? [index] : [],
    );
    const morphIndices = indices.filter((index) => frames[index]?.isOnTarget !== true);
    const arrivedAt = indices.find((index) => frames[index]?.isOnTarget === true);
    const legFrames = morphIndices.map((index) => frames[index] as Frame);
    const frameIndexOf = [...morphIndices];
    if (arrivedAt !== undefined) {
      legFrames.push({
        progress: 1,
        contours: leg.to,
        label: `leg ${leg.index + 1}'s target (arrived ${frames[arrivedAt]?.label ?? ""})`,
        isOnTarget: true,
      });
      frameIndexOf.push(arrivedAt);
    }
    const result = checkHoleMonotonic(legFrames);
    for (const failure of result.failures) {
      failures.push({
        ...failure,
        frameIndices: failure.frameIndices.map((local) => frameIndexOf[local] as number),
        message: `leg ${leg.index + 1}: ${failure.message}`,
      });
    }
    notes.push(...result.notes.map((note) => `leg ${leg.index + 1}: ${note}`));
  }
  return [
    checkSelfIntersection(frames),
    checkResult("hole-monotonic", failures, notes),
    checkContainment(frames),
  ];
}
