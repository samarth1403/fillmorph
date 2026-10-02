import type { Contour } from "../contour";
import { interpolate } from "../morph/interpolate";
import { type SpringConfig, type SpringState, stepSpring } from "./step-spring";
import { popContours } from "./overshoot";
import { overshootRate, visibleRate } from "./visible-rate";

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
  /**
   * True once this leg's spring has reached position 1 (spec 05's fourth reopen). From then on the
   * leg draws only its target, popped by the spring's overshoot or undershoot, and never
   * interpolates from `from` again. A retarget starts a new leg with this false.
   */
  hasArrived: boolean;
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
    hasArrived: false,
  };
}

/**
 * Advances a morph by `dt` seconds: steps the spring toward 1 with `stepSpring`, then gives the
 * shape at the new position with `interpolate`.
 *
 * The spring's own position may overshoot past 1 (or dip below 0) on an underdamped config, but
 * `interpolate` can't take progress outside [0, 1]: past 1 a collapsing hole passes through its
 * collapse point and regrows inside out. So (spec 05's overshoot reopens, for spec 08's Bouncy
 * preset):
 * - **once the leg has arrived** (its spring first reached 1, latched in `hasArrived`), it draws
 *   only its exact `to`, scaled about its center by `popContours`: up slightly while the spring
 *   overshoots, down slightly when it swings back below 1. The bounce stays visible while the
 *   geometry is the target's, with no zero-area placeholders for a retarget to start from, and
 *   the `from` shape never comes back mid-bounce (spec 05's fourth reopen: drawing by position
 *   alone slid the shape back toward `from` on every undershoot);
 * - **below 0, before arriving**, it holds its `from` shape (`interpolate` at 0).
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
      hasArrived: true,
    };
  }
  const hasArrived = state.hasArrived || spring.position >= 1;
  return {
    from: state.from,
    to: state.to,
    spring,
    contours: hasArrived
      ? popContours(state.to, spring.position)
      : interpolate(state.from, state.to, Math.max(0, spring.position)),
    isSettled: false,
    hasArrived,
  };
}

/**
 * Spec 05 #3's interruption rule: starts a new leg toward `to` from the shape on screen now. The
 * new leg's `from` is `state.contours` (the snapshot) and its position resets to 0 (0 = the
 * snapshot, so nothing jumps).
 *
 * Its velocity is converted so the **visible** speed carries over: the old velocity times the old
 * leg's visible rate at its position, divided by the new leg's visible rate at 0 (see
 * `visibleRate`). One unit of progress is a whole leg, so legs of different sizes have different
 * units; carrying the raw number made on-screen speed jump whenever the legs differed in size.
 * Retargeting to the target already being approached thereby continues the same motion: the
 * factor comes out as 1/(1 − position), and a spring's motion scales exactly.
 *
 * - **At rest** (settled, stopped, or not yet moving), or when the old leg wasn't visibly moving,
 *   the new velocity is 0, as it is below position 0 before arriving, where `advanceMorph` holds
 *   the shape still.
 * - **Once the old leg has arrived**, its visible rate is the pop's (`overshootRate`), above or
 *   below 1: the motion on screen there is the target swelling or shrinking, so that is what
 *   carries over.
 * - **Capped at the spring's natural frequency** √(stiffness / mass), keeping its sign. A new leg
 *   that barely moves the shape (a target almost where the shape already is) would otherwise
 *   need an unbounded velocity, infinite for one that doesn't move it at all. The cap is exactly
 *   the largest starting velocity a critically damped spring takes from 0 to 1 without passing 1;
 *   past 1, `interpolate` extrapolates, and a collapsing hole turns inside out. So such a leg
 *   arrives slower than the old motion instead of flying past its target.
 *
 * Applies identically however many times it's chained. Throws, as `interpolate` does, if `to`
 * isn't a coherent contour tree.
 */
export function retargetMorph(state: MorphState, to: Contour[], config: SpringConfig): MorphState {
  return {
    from: state.contours,
    to,
    spring: { position: 0, velocity: carriedVelocity(state, to, config) },
    contours: interpolate(state.contours, to, 0),
    isSettled: false,
    hasArrived: false,
  };
}

function carriedVelocity(state: MorphState, to: Contour[], config: SpringConfig): number {
  const { velocity, position } = state.spring;
  if (velocity === 0 || (position < 0 && !state.hasArrived)) return 0;
  const oldRate = state.hasArrived
    ? overshootRate(state.to, position)
    : visibleRate(state.from, state.to, position);
  if (oldRate === 0) return 0;
  const cap = Math.sqrt(config.stiffness / config.mass);
  const newRate = visibleRate(state.contours, to, 0);
  const converted =
    newRate === 0 ? Number.POSITIVE_INFINITY : (Math.abs(velocity) * oldRate) / newRate;
  return Math.sign(velocity) * Math.min(converted, cap);
}
