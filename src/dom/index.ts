/**
 * `fillmorph/dom` — the stateful layer between core's pure math and the page: it owns the spring
 * state and the `requestAnimationFrame` loop. Depends only on `fillmorph` (core).
 */
export type { MorphDriver, MorphListener } from "./morph-driver";
export { createMorphDriver } from "./morph-driver";
