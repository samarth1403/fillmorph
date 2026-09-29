import type { CheckFailure, CheckResult } from "../checks/check-result.ts";
import { checkResult } from "../checks/check-result.ts";
import { checkContainment } from "../checks/containment.ts";
import { checkHoleMonotonic } from "../checks/hole-monotonic.ts";
import { checkSelfIntersection } from "../checks/self-intersection.ts";
import type { Frame } from "../frames.ts";
import { formatNumber } from "../geometry.ts";
import type { PlaybackTrace } from "./runner.ts";

/** Every trace entry as a checkable frame, labeled with its time, position and leg. */
export function traceFrames(trace: PlaybackTrace): Frame[] {
  return trace.entries.map((entry) => ({
    progress: entry.position,
    contours: entry.contours,
    label: `t=${formatNumber(entry.time)}s p=${formatNumber(entry.position)} (leg ${entry.leg + 1})`,
  }));
}

/**
 * Deliverable #7 reuses deliverable #5's geometry checks on **every** frame of a trace, not just
 * static checkpoints. Self-intersection and containment are per frame. Hole monotonicity is
 * judged per leg, because each leg is a different morph with its own contour ids; within a leg,
 * frames are taken in progress order, so an overshoot past 1 that turns a collapsed hole inside
 * out is caught.
 */
export function checkTraceGeometry(trace: PlaybackTrace): CheckResult[] {
  const frames = traceFrames(trace);
  const failures: CheckFailure[] = [];
  const notes: string[] = [];
  for (const leg of trace.legs) {
    const indices = trace.entries.flatMap((entry, index) =>
      entry.leg === leg.index ? [index] : [],
    );
    const result = checkHoleMonotonic(indices.map((index) => frames[index] as Frame));
    for (const failure of result.failures) {
      failures.push({
        ...failure,
        frameIndices: failure.frameIndices.map((local) => indices[local] as number),
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
