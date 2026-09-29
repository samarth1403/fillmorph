import type { Contour } from "fillmorph";
import type { MorphFn } from "../morph-fn.ts";
import type { PlaybackStepFn, SpringConfig, SpringState } from "./types.ts";

/** Default fixed time step: one 60 Hz display frame. */
export const DEFAULT_PLAYBACK_DT = 1 / 60;

/** What a velocity mapping can see at the instant of an interruption. */
export type InterruptionContext = {
  /** The old leg's position when interrupted. */
  position: number;
  oldFrom: Contour[];
  oldTo: Contour[];
  /** The on-screen shape at the interruption: the new leg's `from`. */
  snapshot: Contour[];
  newTo: Contour[];
};

/**
 * Converts the old leg's exit velocity (old progress units per second) into the new leg's
 * starting velocity (new progress units per second). Spec 05 leaves the exact conversion to its
 * implementation; the runner's default is the identity.
 */
export type VelocityMapping = (velocity: number, context: InterruptionContext) => number;

/** A scripted retarget to a third icon, following spec 05 deliverable #3's leg rule. */
export type ScriptedInterruption = {
  /** Simulated seconds; applied at the first step whose time reaches it. */
  atTime: number;
  to: Contour[];
  mapVelocity?: VelocityMapping;
};

export type PlaybackOptions = {
  step: PlaybackStepFn;
  config: SpringConfig;
  morph: MorphFn;
  from: Contour[];
  to: Contour[];
  /** Simulated seconds to run for. */
  duration: number;
  /** Fixed simulated time step in seconds. Defaults to `DEFAULT_PLAYBACK_DT`. */
  dt?: number;
  interruption?: ScriptedInterruption;
};

/** One recorded step. At an interruption, two entries share a time: the old leg's last, then the new leg's first. */
export type TraceEntry = {
  time: number;
  /** 0-based leg index. */
  leg: number;
  position: number;
  velocity: number;
  /** The `MorphFn`'s output for this leg at `position`. */
  contours: Contour[];
};

export type TraceLeg = { index: number; startTime: number; from: Contour[]; to: Contour[] };

export type TraceInterruption = {
  time: number;
  /** The old leg's position and velocity at the instant of the interruption. */
  positionBefore: number;
  velocityBefore: number;
  /** The new leg's starting velocity, after the velocity mapping. */
  velocityAfter: number;
  context: InterruptionContext;
};

export type PlaybackTrace = {
  dt: number;
  duration: number;
  config: SpringConfig;
  entries: TraceEntry[];
  legs: TraceLeg[];
  interruptions: TraceInterruption[];
};

/**
 * Spec 03 deliverable #7's playback runner. It owns a simulated clock (a fixed `dt`, time
 * computed as `step × dt` so it never drifts, no real timers or `requestAnimationFrame`), the
 * loop, and the trace. Each leg's spring runs toward target 1.
 *
 * On a scripted interruption: the new leg's `from` is the on-screen snapshot, its position resets
 * to 0, and its velocity is the old velocity passed through `mapVelocity` (identity by default).
 * Same inputs always give an identical trace, provided `step` and `morph` are pure.
 */
export function runPlayback(options: PlaybackOptions): PlaybackTrace {
  const dt = options.dt ?? DEFAULT_PLAYBACK_DT;
  if (!(dt > 0)) throw new RangeError(`dt must be a positive number of seconds, got ${dt}`);
  if (!(options.duration > 0)) {
    throw new RangeError(`duration must be a positive number of seconds, got ${options.duration}`);
  }
  const interruption = options.interruption;
  if (
    interruption !== undefined &&
    !(interruption.atTime > 0 && interruption.atTime < options.duration)
  ) {
    throw new RangeError(
      `interruption.atTime must fall inside the run (0, ${options.duration}), got ${interruption.atTime}`,
    );
  }

  const legs: TraceLeg[] = [{ index: 0, startTime: 0, from: options.from, to: options.to }];
  const entries: TraceEntry[] = [];
  const interruptions: TraceInterruption[] = [];
  let leg = legs[0] as TraceLeg;
  let state: SpringState = { position: 0, velocity: 0 };
  let isInterruptionPending = interruption !== undefined;

  const record = (time: number): TraceEntry => {
    const entry: TraceEntry = {
      time,
      leg: leg.index,
      position: state.position,
      velocity: state.velocity,
      contours: options.morph(leg.from, leg.to, state.position),
    };
    entries.push(entry);
    return entry;
  };

  record(0);
  const stepCount = Math.round(options.duration / dt);
  for (let stepIndex = 1; stepIndex <= stepCount; stepIndex++) {
    const time = stepIndex * dt;
    state = options.step(state, options.config, 1, dt);
    const entry = record(time);

    if (
      interruption !== undefined &&
      isInterruptionPending &&
      time >= interruption.atTime - dt * 1e-6
    ) {
      isInterruptionPending = false;
      const context: InterruptionContext = {
        position: state.position,
        oldFrom: leg.from,
        oldTo: leg.to,
        snapshot: entry.contours,
        newTo: interruption.to,
      };
      const velocityAfter = (interruption.mapVelocity ?? ((velocity) => velocity))(
        state.velocity,
        context,
      );
      interruptions.push({
        time,
        positionBefore: state.position,
        velocityBefore: state.velocity,
        velocityAfter,
        context,
      });
      leg = { index: legs.length, startTime: time, from: entry.contours, to: interruption.to };
      legs.push(leg);
      state = { position: 0, velocity: velocityAfter };
      record(time);
    }
  }

  return { dt, duration: options.duration, config: options.config, entries, legs, interruptions };
}
