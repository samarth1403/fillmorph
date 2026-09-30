/**
 * A damped spring's physical constants. `stiffness` and `mass` must be positive and `damping`
 * non-negative, all finite. The damping ratio ζ = damping / (2√(stiffness × mass)) sets the
 * feel: ζ < 1 overshoots and oscillates, ζ ≥ 1 approaches the target without crossing it (from
 * rest), and ζ = 0 never settles.
 */
export type SpringConfig = { stiffness: number; damping: number; mass: number };

/**
 * A spring's state in the current leg's progress space: `position` 0 is the leg's `from`, 1 its
 * `to`; `velocity` is in progress units per second. Plain data owned by the caller — core only
 * computes new states, it never holds one.
 */
export type SpringState = { position: number; velocity: number };

/**
 * Below this `γ·dt` (or `ωd·dt`), sinh/sin(x)/x is taken from its own function rather than a
 * difference of exponentials, which would cancel catastrophically.
 */
const SMALL_ARGUMENT = 1;

/**
 * Advances a damped spring by `dt` seconds toward `target`, returning the new state.
 *
 * Pure: the result depends only on the arguments (no clock reads, no hidden state), so the same
 * call always gives the same answer. It uses the closed-form solution of the damped harmonic
 * oscillator rather than a numerical integrator, so it is exact for any `dt`: stepping by `a`
 * then `b` gives the same state as stepping once by `a + b` (up to floating-point rounding), the
 * motion doesn't depend on frame rate, and a very large `dt` (a backgrounded tab) lands the
 * spring where it would really be instead of blowing up.
 *
 * Throws `RangeError` for a non-finite state, target or `dt`, a negative `dt`, a non-positive
 * `stiffness` or `mass`, or a negative `damping`.
 */
export function stepSpring(
  state: SpringState,
  config: SpringConfig,
  target: number,
  dt: number,
): SpringState {
  validate(state, config, target, dt);
  // `target + (position − target)` needn't round back to `position` exactly.
  if (dt === 0) return { position: state.position, velocity: state.velocity };
  const { stiffness, damping, mass } = config;
  // The displacement e = position − target obeys e″ + 2a·e′ + ω²·e = 0.
  const a = damping / (2 * mass);
  const omegaSquared = stiffness / mass;
  const e0 = state.position - target;
  const v0 = state.velocity;

  // e(t) = e^(−at)·[e0·C(t) + (v0 + a·e0)·S(t)] and e′(t) = e^(−at)·[v0·C(t) − (ω²·e0 + a·v0)·S(t)],
  // where C/S are cos(ωd·t) and sin(ωd·t)/ωd when underdamped, cosh(γt) and sinh(γt)/γ when
  // overdamped, and 1 and t when critically damped.
  const { decayedC, decayedS } = decayedBasis(a, a * a - omegaSquared, dt);
  const displacement = e0 * decayedC + (v0 + a * e0) * decayedS;
  const velocity = v0 * decayedC - (omegaSquared * e0 + a * v0) * decayedS;
  return { position: target + displacement, velocity };
}

/**
 * e^(−at)·C(t) and e^(−at)·S(t) for the oscillator's basis, where `discriminant` = a² − ω² picks
 * the regime. Computed so neither overflows: in the overdamped case e^(−at) and cosh(γt) are
 * combined into decaying exponentials (γ < a always) instead of multiplying a huge number by a
 * tiny one.
 */
function decayedBasis(
  a: number,
  discriminant: number,
  t: number,
): { decayedC: number; decayedS: number } {
  const decay = Math.exp(-a * t);
  if (discriminant < 0) {
    const omegaDamped = Math.sqrt(-discriminant);
    const angle = omegaDamped * t;
    return { decayedC: decay * Math.cos(angle), decayedS: (decay * Math.sin(angle)) / omegaDamped };
  }
  if (discriminant === 0) return { decayedC: decay, decayedS: decay * t };

  const gamma = Math.sqrt(discriminant);
  const argument = gamma * t;
  if (argument < SMALL_ARGUMENT) {
    return {
      decayedC: decay * Math.cosh(argument),
      decayedS: (decay * Math.sinh(argument)) / gamma,
    };
  }
  const slow = Math.exp((gamma - a) * t);
  const fast = Math.exp(-(gamma + a) * t);
  return { decayedC: (slow + fast) / 2, decayedS: (slow - fast) / (2 * gamma) };
}

function validate(state: SpringState, config: SpringConfig, target: number, dt: number): void {
  const problems: string[] = [];
  if (!Number.isFinite(state.position)) problems.push(`state.position is ${state.position}`);
  if (!Number.isFinite(state.velocity)) problems.push(`state.velocity is ${state.velocity}`);
  if (!Number.isFinite(target)) problems.push(`target is ${target}`);
  if (!(Number.isFinite(dt) && dt >= 0)) problems.push(`dt is ${dt} (seconds, must be ≥ 0)`);
  if (!(Number.isFinite(config.stiffness) && config.stiffness > 0)) {
    problems.push(`config.stiffness is ${config.stiffness} (must be > 0)`);
  }
  if (!(Number.isFinite(config.mass) && config.mass > 0)) {
    problems.push(`config.mass is ${config.mass} (must be > 0)`);
  }
  if (!(Number.isFinite(config.damping) && config.damping >= 0)) {
    problems.push(`config.damping is ${config.damping} (must be ≥ 0)`);
  }
  if (problems.length > 0) {
    throw new RangeError(`stepSpring: ${problems.join("; ")}. All values must be finite numbers.`);
  }
}
