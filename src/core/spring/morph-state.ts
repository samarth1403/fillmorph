import type { Contour } from "../contour";
import { interpolate } from "../morph/interpolate";
import { type SpringConfig, type SpringState, stepSpring } from "./step-spring";

/**
 * At rest means within 1e-3 of the target (0.1 canonical units, sub-pixel at any icon size) and
 * slower than 1e-2 progress units per second — the same thresholds spec 03's playback harness
 * judges settling by.
 */
const REST_POSITION_TOLERANCE = 1e-3;
const REST_VELOCITY_TOLERANCE = 1e-2;

/**
 * One spring-driven morph at an instant (spec 05): the current leg's endpoints, its spring, and
 * the shape on screen. Plain immutable data; the functions below return new states and never
 * mutate one, so whoever holds a state (`fillmorph/dom`'s driver, a test, a harness) owns it.
 */
export type MorphState = {
  /** The current leg's start: the original `from`, or the on-screen snapshot at a retarget. */
  from: Contour[];
  /** The current leg's target. */
  to: Contour[];
  /** Position 0 is `from`, 1 is `to`; velocity in progress units per second. */
  spring: SpringState;
  /** The shape on screen now, in the canonical frame. */
  contours: Contour[];
  /** True once the spring has come to rest on `to`; `contours` is then `to` itself. */
  isSettled: boolean;
};

/**
 * The state of a morph from `from` to `to` that hasn't moved yet: at rest at position 0, showing
 * `from` (as `interpolate` lays it out for this pair). Throws, as `interpolate` does, if either
 * side isn't a coherent contour tree.
 */
export function startMorph(from: Contour[], to: Contour[]): MorphState {
  return {
    from,
    to,
    spring: { position: 0, velocity: 0 },
    contours: interpolate(from, to, 0),
    isSettled: false,
  };
}

/**
 * Advances a morph by `dt` seconds: steps the spring toward 1 with `stepSpring`, then gives the
 * shape at the new position with `interpolate`.
 *
 * Settling: once within `REST_POSITION_TOLERANCE` of 1 and slower than `REST_VELOCITY_TOLERANCE`,
 * the spring snaps to exactly 1 at rest and `contours` becomes the leg's `to` itself — not
 * `interpolate(from, to, 1)`, which would still carry zero-area contours for anything that
 * disappeared. A settled state stays settled. Throws `RangeError` for an invalid `config` or `dt`
 * (see `stepSpring`).
 */
export function advanceMorph(state: MorphState, config: SpringConfig, dt: number): MorphState {
  const spring = stepSpring(state.spring, config, 1, dt);
  if (
    Math.abs(spring.position - 1) <= REST_POSITION_TOLERANCE &&
    Math.abs(spring.velocity) <= REST_VELOCITY_TOLERANCE
  ) {
    return {
      from: state.from,
      to: state.to,
      spring: { position: 1, velocity: 0 },
      contours: state.to,
      isSettled: true,
    };
  }
  return {
    from: state.from,
    to: state.to,
    spring,
    contours: interpolate(state.from, state.to, spring.position),
    isSettled: false,
  };
}

/**
 * Spec 05 #3's interruption rule: starts a new leg toward `to` from the shape on screen now. The
 * new leg's `from` is `state.contours` (the snapshot), its position resets to 0 (0 = the
 * snapshot, so nothing jumps), and its velocity carries over unchanged, so the motion doesn't
 * stop or snap. Applies identically however many times it's chained, and from a settled state
 * (then from rest). Throws, as `interpolate` does, if `to` isn't a coherent contour tree.
 */
export function retargetMorph(state: MorphState, to: Contour[]): MorphState {
  return {
    from: state.contours,
    to,
    spring: { position: 0, velocity: state.spring.velocity },
    contours: interpolate(state.contours, to, 0),
    isSettled: false,
  };
}
