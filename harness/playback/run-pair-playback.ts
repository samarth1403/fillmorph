import { parseIcon } from "fillmorph";
import { loadFixture } from "../fixtures.ts";
import type { MorphFn } from "../morph-fn.ts";
import type { ReferencePair } from "../pairs.ts";
import { autoTuneSpring } from "./auto-tune.ts";
import type { PlaybackSection } from "./playback-page.ts";
import { DEFAULT_PLAYBACK_DT, runPlayback, type VelocityMapping } from "./runner.ts";
import {
  checkSettling,
  checkVelocityContinuity,
  DEFAULT_CONTINUITY,
  DEFAULT_SETTLING,
} from "./timing-checks.ts";
import { checkTraceGeometry } from "./trace-geometry.ts";
import type { PlaybackStepFn, SpringConfig } from "./types.ts";

export type PairPlaybackOptions = {
  step: PlaybackStepFn;
  morph: MorphFn;
  /** Starting spring config, auto-tuned against the timing checks before the final run. */
  base: SpringConfig;
  mapVelocity?: VelocityMapping;
  /** Simulated seconds. Defaults to 3. */
  duration?: number;
  /** When the scripted retarget to `pair.interruptTo` happens. Defaults to 0.2 s. */
  interruptAt?: number;
  dt?: number;
};

/**
 * Deliverable #7 end to end for one reference pair: `from` → `to`, interrupted mid-flight toward
 * `interruptTo`. Auto-tunes the spring first, then records the final trace with the chosen config
 * (or the starting one, if nothing passed) and runs every geometry and timing check on it.
 */
export function runPairPlayback(
  pair: ReferencePair,
  options: PairPlaybackOptions,
): PlaybackSection {
  const interruption = {
    atTime: options.interruptAt ?? 0.2,
    to: parseIcon(loadFixture(pair.interruptTo)).contours,
    ...(options.mapVelocity === undefined ? {} : { mapVelocity: options.mapVelocity }),
  };
  const playback = {
    step: options.step,
    morph: options.morph,
    from: parseIcon(loadFixture(pair.from)).contours,
    to: parseIcon(loadFixture(pair.to)).contours,
    duration: options.duration ?? 3,
    dt: options.dt ?? DEFAULT_PLAYBACK_DT,
    interruption,
  };
  const tuning = autoTuneSpring({ base: options.base, playback });
  const trace = runPlayback({ ...playback, config: tuning.config ?? options.base });
  const checks = [
    ...checkTraceGeometry(trace),
    checkSettling(trace, DEFAULT_SETTLING),
    checkVelocityContinuity(trace, options.morph, DEFAULT_CONTINUITY),
  ];
  return {
    title: pair.name,
    subtitle: `${pair.covers} · ${pair.from} → ${pair.to}, retargeted to ${pair.interruptTo} at t=${interruption.atTime}s`,
    trace,
    checks,
    tuning,
  };
}
