import {
  advanceMorph,
  type Contour,
  type MorphState,
  retargetMorph,
  type SpringConfig,
  startMorph,
  stepSpring,
} from "fillmorph";

/**
 * The driver's starting feel when no config is given: nearly critically damped (ζ ≈ 0.997), so a
 * morph from rest reaches its target without visibly overshooting and settles in about 0.8 s. A
 * tunable starting point, not a fixed part of the API (spec 05 deliverable #1).
 */
const DEFAULT_SPRING_CONFIG: SpringConfig = { stiffness: 170, damping: 26, mass: 1 };

/** Receives the morph's current canonical-frame contours. */
export type MorphListener = (contours: Contour[]) => void;

/** A running morph; see `createMorphDriver`. */
export type MorphDriver = {
  /**
   * Starts a new leg toward `to` from whatever shape is on screen now, carrying the current
   * on-screen speed over (core's `retargetMorph` converts the velocity), so an in-flight morph
   * turns toward the new target without a snap, a pause or a sudden speed-up. Works
   * the same on a settled or stopped driver (then from rest). Throws, before changing anything,
   * if `to` isn't a coherent contour tree (see `interpolate`).
   */
  retarget: (to: Contour[]) => void;
  /**
   * Calls `listener` right away with the current contours, then once per animation frame while
   * the morph moves, and once more with the exact target when it settles. Returns an unsubscribe
   * function.
   */
  subscribe: (listener: MorphListener) => () => void;
  /**
   * Halts the animation where it is: cancels the pending frame and drops the velocity, so no
   * further frames run. The shape stays as last reported; a later `retarget` starts from it.
   */
  stop: () => void;
};

/**
 * Spec 05's animation driver: animates `from` → `to` with a spring, producing the morph's
 * contours every `requestAnimationFrame` until it settles.
 *
 * All of the morph's rules — stepping the spring, interpolating, settling on the exact target,
 * and the retarget ("leg") rule — are core's `startMorph` / `advanceMorph` / `retargetMorph`, the
 * same functions spec 03's playback harness runs. This driver adds only what a page needs around
 * them: it holds the one mutable `MorphState`, schedules frames, turns frame timestamps into
 * `dt`, and hands each new shape to its subscribers.
 *
 * - **Time:** `dt` comes only from the timestamps `requestAnimationFrame` passes in (the first
 *   frame of a run steps by 0), so a fake `requestAnimationFrame` fully controls the clock.
 * - **Settling:** once `advanceMorph` reports the morph settled, the listeners get the exact
 *   target and no further frame is requested.
 *
 * The driver writes nothing to the DOM itself: a listener renders the contours, e.g.
 * `path.setAttribute("d", renderContours(contours))` inside a `CANONICAL_VIEW_BOX` `<svg>`.
 * Contours must come from `parseIcon` (or a previous morph) and `config` must be valid for
 * `stepSpring`; both are checked here, synchronously.
 */
export function createMorphDriver(
  from: Contour[],
  to: Contour[],
  config: SpringConfig = DEFAULT_SPRING_CONFIG,
): MorphDriver {
  // A zero-length step validates the config now instead of inside the first animation frame.
  stepSpring({ position: 0, velocity: 0 }, config, 1, 0);
  let state: MorphState = startMorph(from, to);
  let frameId: number | null = null;
  let lastTimestamp: number | null = null;
  const listeners = new Set<MorphListener>();

  const notify = (): void => {
    for (const listener of [...listeners]) listener(state.contours);
  };

  const frame = (timestamp: number): void => {
    frameId = null;
    const dt = lastTimestamp === null ? 0 : Math.max(0, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;
    state = advanceMorph(state, config, dt);
    if (state.isSettled) lastTimestamp = null;
    else frameId = requestAnimationFrame(frame);
    notify();
  };

  frameId = requestAnimationFrame(frame);

  return {
    retarget(newTo) {
      state = retargetMorph(state, newTo, config);
      if (frameId === null) frameId = requestAnimationFrame(frame);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state.contours);
      return () => {
        listeners.delete(listener);
      };
    },
    stop() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      lastTimestamp = null;
      state = { ...state, spring: { position: state.spring.position, velocity: 0 } };
    },
  };
}
