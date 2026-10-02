import { parseIcon, type SpringConfig } from "fillmorph";
import { loadFixture } from "../fixtures.ts";
import type { ReferencePair } from "../pairs.ts";
import { checkArrivedShape } from "./arrived-shape.ts";
import { autoTuneSpring } from "./auto-tune.ts";
import type { PlaybackSection } from "./playback-page.ts";
import { DEFAULT_PLAYBACK_DT, runPlayback } from "./runner.ts";
import {
  checkPositionContinuity,
  checkSettling,
  checkVelocityContinuity,
  DEFAULT_CONTINUITY,
  DEFAULT_SETTLING,
} from "./timing-checks.ts";
import { checkTraceGeometry } from "./trace-geometry.ts";

export type PairPlaybackOptions = {
  /** Starting spring config, auto-tuned against the timing checks before the final run. */
  base: SpringConfig;
  /**
   * False runs `base` exactly as given, without auto-tuning: for grading a fixed config such as
   * spec 08's overshooting Bouncy preset. Defaults to true.
   */
  isAutoTuned?: boolean;
  /** Simulated seconds. Defaults to 3. */
  duration?: number;
  /** When the scripted retarget to `pair.interruptTo` happens. Defaults to 0.2 s. */
  interruptAt?: number;
  dt?: number;
};

/**
 * Deliverable #7 end to end for one reference pair: `from` → `to`, interrupted mid-flight toward
 * `interruptTo`. Auto-tunes the spring first (unless `isAutoTuned` is false), then records the final trace with the chosen config
 * (or the starting one, if nothing passed) and runs every geometry and timing check on it.
 */
export function runPairPlayback(
  pair: ReferencePair,
  options: PairPlaybackOptions,
): PlaybackSection {
  const interruption = {
    atTime: options.interruptAt ?? 0.2,
    to: parseIcon(loadFixture(pair.interruptTo)).contours,
  };
  const playback = {
    from: parseIcon(loadFixture(pair.from)).contours,
    to: parseIcon(loadFixture(pair.to)).contours,
    duration: options.duration ?? 3,
    dt: options.dt ?? DEFAULT_PLAYBACK_DT,
    interruption,
  };
  const tuning =
    options.isAutoTuned === false ? null : autoTuneSpring({ base: options.base, playback });
  const trace = runPlayback({ ...playback, config: tuning?.config ?? options.base });
  const checks = [
    ...checkTraceGeometry(trace),
    checkSettling(trace, DEFAULT_SETTLING),
    checkVelocityContinuity(trace, DEFAULT_CONTINUITY),
    checkPositionContinuity(trace),
    checkArrivedShape(trace),
  ];
  return {
    title: pair.name,
    subtitle: `${pair.covers} · ${pair.from} → ${pair.to}, retargeted to ${pair.interruptTo} at t=${interruption.atTime}s`,
    trace,
    checks,
    tuning,
  };
}
