import type { VelocityMapping } from "./runner.ts";
import type { PlaybackStepFn } from "./types.ts";

/**
 * Stand-in step functions and velocity mappings for deliverable #7, until spec 05's real
 * `stepSpring` exists. Like `naiveMorph`, they're fixtures that prove the timing checks catch
 * what they should — not candidate implementations of spec 05.
 */

/** Well-behaved: a damped spring, semi-implicit Euler, honoring every field of the config. */
export const dampedStubStep: PlaybackStepFn = (state, config, target, dt) => {
  const acceleration =
    (config.stiffness * (target - state.position) - config.damping * state.velocity) / config.mass;
  const velocity = state.velocity + acceleration * dt;
  return { position: state.position + velocity * dt, velocity };
};

/** Badly behaved: ignores `damping`, so it oscillates around the target forever. */
export const undampedStubStep: PlaybackStepFn = (state, config, target, dt) =>
  dampedStubStep(state, { ...config, damping: 0 }, target, dt);

/** Well-behaved interruption: velocity carries over unchanged (the runner's default). */
export const carryVelocity: VelocityMapping = (velocity) => velocity;

/** Badly behaved interruption: velocity resets to zero, a visible snap. */
export const resetVelocity: VelocityMapping = () => 0;
