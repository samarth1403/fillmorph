/**
 * Harness-local placeholders mirroring spec 05's `SpringState` / `SpringConfig` / `stepSpring`
 * shapes, so the playback runner can be built before spec 05. **Temporary:** once spec 05 lands,
 * these are deleted and imported from `fillmorph` instead; no copy is kept.
 */

/** `position` is in the current leg's progress space; `velocity` in progress units per second. */
export type SpringState = { position: number; velocity: number };

export type SpringConfig = { stiffness: number; damping: number; mass: number };

/**
 * The pluggable step function, exactly the shape of spec 05's `stepSpring`: advances `state`
 * toward `target` by `dt` seconds. Must be pure.
 */
export type PlaybackStepFn = (
  state: SpringState,
  config: SpringConfig,
  target: number,
  dt: number,
) => SpringState;
