import type { Contour, Point } from "fillmorph";
import { type CheckFailure, type CheckResult, checkResult } from "../checks/check-result.ts";
import { formatNumber } from "../geometry.ts";
import type { MorphFn } from "../morph-fn.ts";
import type { PlaybackTrace, TraceEntry } from "./runner.ts";

export type SettlingOptions = {
  /** Seconds after the final leg starts by which the spring must have settled. */
  bound: number;
  /** Settled means |position − 1| ≤ this (progress units)… */
  positionTolerance: number;
  /** …and |velocity| ≤ this (progress units per second), from then to the end of the trace. */
  velocityTolerance: number;
};

/**
 * Starting values, tunable like spec 05's config. 1e-3 of the morph is 0.1 canonical units,
 * sub-pixel at any icon size.
 */
export const DEFAULT_SETTLING: SettlingOptions = {
  bound: 2,
  positionTolerance: 1e-3,
  velocityTolerance: 1e-2,
};

export type SettlingResult = CheckResult & {
  /** Seconds from the final leg's start until it settled for good; null if it never did. */
  settleTime: number | null;
};

function isSettled(entry: TraceEntry, options: SettlingOptions): boolean {
  return (
    Math.abs(entry.position - 1) <= options.positionTolerance &&
    Math.abs(entry.velocity) <= options.velocityTolerance
  );
}

/**
 * Deliverable #7 settling check: the final leg (earlier legs are interrupted, so never settle)
 * must come to rest at its target within `bound` seconds and stay there for the rest of the
 * trace. The trace must extend at least `bound` past the final leg's start, or staying settled
 * can't be verified and the check fails.
 */
export function checkSettling(
  trace: PlaybackTrace,
  options: SettlingOptions = DEFAULT_SETTLING,
): SettlingResult {
  const finalLeg = trace.legs[trace.legs.length - 1];
  const indexed = trace.entries.map((entry, index) => ({ entry, index }));
  const legEntries = indexed.filter(({ entry }) => entry.leg === finalLeg?.index);
  const startTime = finalLeg?.startTime ?? 0;
  const last = legEntries[legEntries.length - 1];
  if (last === undefined) {
    return {
      ...checkResult("settling", [
        { frameIndices: [], contourId: null, message: "the trace has no entries" },
      ]),
      settleTime: null,
    };
  }

  let settledFrom: number | null = null;
  for (let position = legEntries.length - 1; position >= 0; position--) {
    const candidate = legEntries[position] as (typeof legEntries)[number];
    if (!isSettled(candidate.entry, options)) break;
    settledFrom = position;
  }
  const settleTime =
    settledFrom === null
      ? null
      : (legEntries[settledFrom] as (typeof legEntries)[number]).entry.time - startTime;

  const failures: CheckFailure[] = [];
  const coverage = last.entry.time - startTime;
  if (settleTime === null) {
    failures.push({
      frameIndices: [last.index],
      contourId: null,
      message:
        `never settled: at the end of the trace (t=${formatNumber(last.entry.time)}s) position is ` +
        `${formatNumber(last.entry.position, 4)} and velocity ${formatNumber(last.entry.velocity, 4)}/s`,
    });
  } else if (settleTime > options.bound) {
    failures.push({
      frameIndices: [(legEntries[settledFrom as number] as (typeof legEntries)[number]).index],
      contourId: null,
      message: `settled ${formatNumber(settleTime)}s after the final leg started, past the ${options.bound}s bound`,
    });
  }
  if (coverage < options.bound) {
    failures.push({
      frameIndices: [],
      contourId: null,
      message: `the final leg only runs ${formatNumber(coverage)}s, less than the ${options.bound}s bound, so staying settled can't be verified`,
    });
  }
  const notes =
    settleTime === null ? [] : [`settled ${formatNumber(settleTime)}s after the final leg started`];
  return { ...checkResult("settling", failures, notes), settleTime };
}

export type ContinuityOptions = {
  /** On-screen speed may change across an interruption by at most this factor, either way. */
  maxSpeedRatio: number;
  /** Below this speed (canonical units per second) the shape counts as at rest. */
  restSpeed: number;
};

/** Starting values, tunable. */
export const DEFAULT_CONTINUITY: ContinuityOptions = { maxSpeedRatio: 1.5, restSpeed: 1e-3 };

/** Step for the numerical derivative of a `MorphFn` with respect to progress. */
const DERIVATIVE_STEP = 1e-4;

/**
 * Root-mean-square speed of every vertex, in canonical units per progress unit, of `morph(from,
 * to, ·)` at `progress`. Null when the two samples don't share a structure (ids and point counts),
 * since vertices can't then be paired.
 */
function shapeRate(
  morph: MorphFn,
  from: Contour[],
  to: Contour[],
  progress: number,
): number | null {
  const before = morph(from, to, progress - DERIVATIVE_STEP);
  const after = morph(from, to, progress + DERIVATIVE_STEP);
  if (before.length !== after.length) return null;
  let sumOfSquares = 0;
  let count = 0;
  for (const [index, contour] of before.entries()) {
    const other = after[index] as Contour;
    if (other.id !== contour.id || other.points.length !== contour.points.length) return null;
    for (const [pointIndex, point] of contour.points.entries()) {
      const moved = other.points[pointIndex] as Point;
      sumOfSquares += (moved.x - point.x) ** 2 + (moved.y - point.y) ** 2;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.sqrt(sumOfSquares / count) / (2 * DERIVATIVE_STEP);
}

/**
 * Deliverable #7 velocity-continuity check: at each interruption, the shape's on-screen speed
 * (RMS vertex speed, canonical units per second) just before and just after the retarget must
 * agree within `maxSpeedRatio`. Speed = |velocity| × how fast the leg's geometry moves per unit
 * of progress, so it's measured in the same units on both sides even though each leg has its own
 * progress space — this is what lets it judge spec 05's velocity conversion, not just compare two
 * numbers in different units. Speed is compared, not direction: retargeting turns the motion by
 * design.
 */
export function checkVelocityContinuity(
  trace: PlaybackTrace,
  morph: MorphFn,
  options: ContinuityOptions = DEFAULT_CONTINUITY,
): CheckResult {
  if (trace.interruptions.length === 0) {
    return checkResult(
      "velocity-continuity",
      [],
      ["no interruption in this trace; nothing to check"],
    );
  }
  const failures: CheckFailure[] = [];
  const notes: string[] = [];
  for (const interruption of trace.interruptions) {
    const { context } = interruption;
    const frameIndices = trace.entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.time === interruption.time)
      .map(({ index }) => index);
    const at = `t=${formatNumber(interruption.time)}s`;
    const rateBefore = shapeRate(morph, context.oldFrom, context.oldTo, context.position);
    const rateAfter = shapeRate(morph, context.snapshot, context.newTo, 0);
    if (rateBefore === null || rateAfter === null) {
      failures.push({
        frameIndices,
        contourId: null,
        message: `${at}: the MorphFn's output changes structure between nearby progress values, so on-screen speed can't be measured`,
      });
      continue;
    }
    const speedBefore = Math.abs(interruption.velocityBefore) * rateBefore;
    const speedAfter = Math.abs(interruption.velocityAfter) * rateAfter;
    const summary = `speed ${formatNumber(speedBefore)} → ${formatNumber(speedAfter)} units/s`;
    if (speedBefore <= options.restSpeed && speedAfter <= options.restSpeed) {
      notes.push(`${at}: at rest on both sides of the interruption`);
      continue;
    }
    const ratio = speedAfter / speedBefore;
    if (!(ratio <= options.maxSpeedRatio && ratio >= 1 / options.maxSpeedRatio)) {
      failures.push({
        frameIndices,
        contourId: null,
        message:
          `${at}: on-screen speed jumps across the interruption (${summary}, ` +
          `velocity ${formatNumber(interruption.velocityBefore)} → ${formatNumber(interruption.velocityAfter)} progress/s); ` +
          `allowed ratio is 1/${options.maxSpeedRatio}–${options.maxSpeedRatio}`,
      });
    } else {
      notes.push(`${at}: ${summary}`);
    }
  }
  return checkResult("velocity-continuity", failures, notes);
}
