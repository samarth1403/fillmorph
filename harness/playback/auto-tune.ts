import type { MorphFn } from "../morph-fn.ts";
import { type PlaybackOptions, runPlayback } from "./runner.ts";
import {
  type ContinuityOptions,
  checkSettling,
  checkVelocityContinuity,
  DEFAULT_CONTINUITY,
  DEFAULT_SETTLING,
  type SettlingOptions,
} from "./timing-checks.ts";
import type { SpringConfig } from "./types.ts";

export type AutoTuneOptions = {
  /** The starting config: kept unchanged if it already passes. */
  base: SpringConfig;
  /** Everything a playback run needs except the config being tuned. */
  playback: Omit<PlaybackOptions, "config">;
  settling?: SettlingOptions;
  continuity?: ContinuityOptions;
  /** Stiffness candidates, as multiples of `base.stiffness`. */
  stiffnessFactors?: readonly number[];
  /** Damping candidates, as damping ratios ζ = damping / (2√(stiffness × mass)). */
  dampingRatios?: readonly number[];
};

export type AutoTuneCandidate = {
  config: SpringConfig;
  passed: boolean;
  settleTime: number | null;
  failures: string[];
};

export type AutoTuneResult = {
  /** The chosen config, or null when no candidate passes (reported, never papered over). */
  config: SpringConfig | null;
  baseConfigPassed: boolean;
  candidates: AutoTuneCandidate[];
};

const DEFAULT_STIFFNESS_FACTORS = [0.5, 0.71, 1, 1.41, 2];
const DEFAULT_DAMPING_RATIOS = [0.4, 0.55, 0.7, 0.85, 1, 1.25, 1.5];

function dampingRatio(config: SpringConfig): number {
  return config.damping / (2 * Math.sqrt(config.stiffness * config.mass));
}

function evaluate(
  config: SpringConfig,
  playback: Omit<PlaybackOptions, "config">,
  morph: MorphFn,
  settling: SettlingOptions,
  continuity: ContinuityOptions,
): AutoTuneCandidate {
  const trace = runPlayback({ ...playback, config });
  const settled = checkSettling(trace, settling);
  const continuous = checkVelocityContinuity(trace, morph, continuity);
  const failures = [...settled.failures, ...continuous.failures].map((failure) => failure.message);
  return { config, passed: failures.length === 0, settleTime: settled.settleTime, failures };
}

/**
 * Deliverable #7 auto-tuning: adjusts stiffness/damping against the timing checks (settling and
 * velocity continuity) before anything is shown to a human. Deterministic grid search:
 *
 * 1. If `base` passes, it's returned unchanged — tuning never alters a feel that already works.
 * 2. Otherwise every stiffness × damping-ratio candidate (mass kept) is run, and the passing one
 *    **closest to `base`** is chosen (distance = |ln(k / k₀)| + |ζ − ζ₀|), ties going to the
 *    faster settle, then to candidate order. Staying close keeps the designer's intended feel.
 * 3. If nothing passes, `config` is null.
 *
 * Geometry checks aren't tuned against: they judge the `MorphFn`, which the spring config can't fix.
 */
export function autoTuneSpring(options: AutoTuneOptions): AutoTuneResult {
  const settling = options.settling ?? DEFAULT_SETTLING;
  const continuity = options.continuity ?? DEFAULT_CONTINUITY;
  const { morph } = options.playback;
  const base = evaluate(options.base, options.playback, morph, settling, continuity);
  if (base.passed) return { config: options.base, baseConfigPassed: true, candidates: [base] };

  const candidates: AutoTuneCandidate[] = [base];
  for (const factor of options.stiffnessFactors ?? DEFAULT_STIFFNESS_FACTORS) {
    const stiffness = options.base.stiffness * factor;
    for (const ratio of options.dampingRatios ?? DEFAULT_DAMPING_RATIOS) {
      const config: SpringConfig = {
        stiffness,
        damping: ratio * 2 * Math.sqrt(stiffness * options.base.mass),
        mass: options.base.mass,
      };
      candidates.push(evaluate(config, options.playback, morph, settling, continuity));
    }
  }

  const baseRatio = dampingRatio(options.base);
  const distance = (config: SpringConfig) =>
    Math.abs(Math.log(config.stiffness / options.base.stiffness)) +
    Math.abs(dampingRatio(config) - baseRatio);
  let best: AutoTuneCandidate | null = null;
  for (const candidate of candidates) {
    if (!candidate.passed) continue;
    if (best === null) {
      best = candidate;
      continue;
    }
    const gap = distance(candidate.config) - distance(best.config);
    const isFaster =
      (candidate.settleTime ?? Number.POSITIVE_INFINITY) <
      (best.settleTime ?? Number.POSITIVE_INFINITY);
    if (gap < -1e-12 || (Math.abs(gap) <= 1e-12 && isFaster)) best = candidate;
  }
  return { config: best?.config ?? null, baseConfigPassed: false, candidates };
}
