import {
  advanceMorph,
  type Contour,
  type MorphState,
  retargetMorph,
  type SpringConfig,
  startMorph,
} from "fillmorph";

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
 * **Fault injection for the harness's own tests only:** replaces the new leg's starting velocity
 * after core's `retargetMorph` has run (e.g. `resetVelocity`, to prove the continuity check
 * catches a snap). The CLI never sets it, so reference-pair runs grade `retargetMorph` unchanged.
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
  config: SpringConfig;
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
  /** The shape on screen: the `MorphState`'s `contours` after this step. */
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
 * Spec 03 deliverable #7's playback runner. It runs **the same morph code a page runs**: core's
 * `startMorph` / `advanceMorph` / `retargetMorph` (spec 05), which `fillmorph/dom`'s
 * `createMorphDriver` also drives. So every rule being graded here (spring stepping,
 * interpolation, settling on the exact target, and the retarget rule) is the shipped
 * implementation, not a copy of it. What differs from the driver is only the scheduling: this
 * runner owns a simulated clock (a fixed `dt`, time computed as `step × dt` so it never drifts, no
 * real timers or `requestAnimationFrame`) where the driver uses animation-frame timestamps, and it
 * records a trace.
 *
 * A scripted interruption calls `retargetMorph` right after the step that reaches `atTime`; both
 * sides are recorded at that time. Same inputs always give an identical trace.
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

  let state: MorphState = startMorph(options.from, options.to);
  const legs: TraceLeg[] = [{ index: 0, startTime: 0, from: state.from, to: state.to }];
  const entries: TraceEntry[] = [];
  const interruptions: TraceInterruption[] = [];
  let legIndex = 0;
  let isInterruptionPending = interruption !== undefined;

  const record = (time: number): void => {
    entries.push({
      time,
      leg: legIndex,
      position: state.spring.position,
      velocity: state.spring.velocity,
      contours: state.contours,
    });
  };

  record(0);
  const stepCount = Math.round(options.duration / dt);
  for (let stepIndex = 1; stepIndex <= stepCount; stepIndex++) {
    const time = stepIndex * dt;
    state = advanceMorph(state, options.config, dt);
    record(time);

    if (
      interruption !== undefined &&
      isInterruptionPending &&
      time >= interruption.atTime - dt * 1e-6
    ) {
      isInterruptionPending = false;
      const before = state;
      state = retargetMorph(before, interruption.to);
      const context: InterruptionContext = {
        position: before.spring.position,
        oldFrom: before.from,
        oldTo: before.to,
        snapshot: before.contours,
        newTo: interruption.to,
      };
      if (interruption.mapVelocity !== undefined) {
        const velocity = interruption.mapVelocity(before.spring.velocity, context);
        state = { ...state, spring: { ...state.spring, velocity } };
      }
      interruptions.push({
        time,
        positionBefore: before.spring.position,
        velocityBefore: before.spring.velocity,
        velocityAfter: state.spring.velocity,
        context,
      });
      legIndex++;
      legs.push({ index: legIndex, startTime: time, from: state.from, to: state.to });
      record(time);
    }
  }

  return { dt, duration: options.duration, config: options.config, entries, legs, interruptions };
}
