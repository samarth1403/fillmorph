import { parseIcon } from "fillmorph";
import type { CheckResult } from "./checks/check-result.ts";
import { checkContainment } from "./checks/containment.ts";
import { checkHoleMonotonic } from "./checks/hole-monotonic.ts";
import { checkSelfIntersection } from "./checks/self-intersection.ts";
import { loadFixture } from "./fixtures.ts";
import { type Frame, sampleFrames } from "./frames.ts";
import type { MorphFn } from "./morph-fn.ts";
import type { ReferencePair } from "./pairs.ts";

/** Runs all three deliverable #5 geometry checks over one frame sequence. */
export function runGeometryChecks(frames: readonly Frame[]): CheckResult[] {
  return [checkSelfIntersection(frames), checkHoleMonotonic(frames), checkContainment(frames)];
}

/** Everything one harness run of one reference pair produced. */
export type PairRun = {
  pair: ReferencePair;
  frames: Frame[];
  checks: CheckResult[];
  passed: boolean;
};

/** Parses the pair's fixtures, samples `morph` at `progressSteps`, and runs the geometry checks. */
export function runPair(
  pair: ReferencePair,
  morph: MorphFn,
  progressSteps: readonly number[],
): PairRun {
  const from = parseIcon(loadFixture(pair.from)).contours;
  const to = parseIcon(loadFixture(pair.to)).contours;
  const frames = sampleFrames(morph, from, to, progressSteps);
  const checks = runGeometryChecks(frames);
  return { pair, frames, checks, passed: checks.every((check) => check.passed) };
}
