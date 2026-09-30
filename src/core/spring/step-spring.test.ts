import { describe, expect, it, vi } from "vitest";
import { mulberry32 } from "../morph/test-helpers";
import { type SpringConfig, type SpringState, stepSpring } from "./step-spring";

const AT_REST: SpringState = { position: 0, velocity: 0 };
const FRAME = 1 / 60;

function withRatio(stiffness: number, ratio: number, mass = 1): SpringConfig {
  return { stiffness, damping: ratio * 2 * Math.sqrt(stiffness * mass), mass };
}

/** Steps a fake clock forward in fixed frames, recording every state. */
function run(config: SpringConfig, seconds: number, start = AT_REST, dt = FRAME): SpringState[] {
  const states = [start];
  let state = start;
  for (let step = 0; step < Math.round(seconds / dt); step++) {
    state = stepSpring(state, config, 1, dt);
    states.push(state);
  }
  return states;
}

/** Fine-step semi-implicit Euler: an independent reference for the closed form. */
function integrate(state: SpringState, config: SpringConfig, target: number, dt: number) {
  const steps = 200_000;
  const h = dt / steps;
  let { position, velocity } = state;
  for (let step = 0; step < steps; step++) {
    const acceleration =
      (config.stiffness * (target - position) - config.damping * velocity) / config.mass;
    velocity += acceleration * h;
    position += velocity * h;
  }
  return { position, velocity };
}

describe("stepSpring", () => {
  it("returns the state unchanged for dt = 0", () => {
    const state = { position: 0.3, velocity: -2 };
    expect(stepSpring(state, withRatio(170, 0.5), 1, 0)).toEqual(state);
  });

  it("stays at rest on the target", () => {
    const state = stepSpring({ position: 1, velocity: 0 }, withRatio(170, 0.5), 1, 0.5);
    expect(state).toEqual({ position: 1, velocity: 0 });
  });

  it("does not read the clock or schedule anything", () => {
    vi.useFakeTimers();
    const now = vi.spyOn(Date, "now");
    stepSpring(AT_REST, withRatio(170, 1), 1, 0.1);
    expect(now).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["underdamped", 0.4],
    ["critically damped", 1],
    ["overdamped", 2.5],
  ])("matches a fine numerical integration when %s", (_, ratio) => {
    const config = withRatio(170, ratio, 1.3);
    for (const start of [
      AT_REST,
      { position: 0.4, velocity: 3 },
      { position: 1.2, velocity: -1 },
    ]) {
      const exact = stepSpring(start, config, 1, 0.37);
      const reference = integrate(start, config, 1, 0.37);
      expect(exact.position).toBeCloseTo(reference.position, 4);
      expect(exact.velocity).toBeCloseTo(reference.velocity, 3);
    }
  });

  it("approaches the target from rest, without crossing it, when damping ratio ≥ 1", () => {
    // ζ = 4 creeps in slowly, so it gets longer to arrive.
    for (const [ratio, seconds] of [
      [1, 3],
      [1.5, 3],
      [4, 20],
    ] as const) {
      const states = run(withRatio(170, ratio), seconds);
      for (const [index, state] of states.entries()) {
        expect(state.position).toBeLessThanOrEqual(1);
        if (index > 0)
          expect(state.position).toBeGreaterThan((states[index - 1] as SpringState).position);
      }
      expect((states[states.length - 1] as SpringState).position).toBeCloseTo(1, 3);
    }
  });

  it("overshoots the target and comes back when underdamped", () => {
    const states = run(withRatio(170, 0.3), 3);
    const peak = Math.max(...states.map((state) => state.position));
    expect(peak).toBeGreaterThan(1.3);
    const last = states[states.length - 1] as SpringState;
    expect(last.position).toBeCloseTo(1, 3);
  });

  it("settles: stays within 1e-3 of the target with velocity under 1e-2/s from some time on", () => {
    for (const ratio of [0.5, 1, 2]) {
      const states = run(withRatio(170, ratio), 4);
      const isSettled = (state: SpringState) =>
        Math.abs(state.position - 1) <= 1e-3 && Math.abs(state.velocity) <= 1e-2;
      const firstSettled = states.findIndex(isSettled);
      expect(firstSettled).toBeGreaterThan(0);
      expect(states.slice(firstSettled).every(isSettled)).toBe(true);
    }
  });

  it("never settles without damping: the oscillation keeps its amplitude", () => {
    const config = { stiffness: 170, damping: 0, mass: 1 };
    const states = run(config, 10);
    // Energy from rest at displacement −1 is k/2; frames sample the peak only approximately, so
    // check that the energy is conserved rather than the sampled extremes.
    for (const state of states) {
      const energy = 0.5 * config.stiffness * (state.position - 1) ** 2 + 0.5 * state.velocity ** 2;
      expect(energy).toBeCloseTo(config.stiffness / 2, 6);
    }
    const lastSecond = states.slice(-60);
    expect(Math.max(...lastSecond.map((state) => state.position))).toBeGreaterThan(1.99);
  });

  it("drives toward any target, not just 1", () => {
    const state = run(withRatio(170, 1), 3, { position: 5, velocity: 0 }).at(-1) as SpringState;
    expect(state.position).toBeCloseTo(1, 3);
    const toMinus = stepSpring({ position: 0, velocity: 0 }, withRatio(170, 1), -2, 3);
    expect(toMinus.position).toBeCloseTo(-2, 6);
  });

  it("is frame-rate independent: one step of a + b equals a step of a then b (property)", () => {
    const random = mulberry32(5);
    for (let run = 0; run < 300; run++) {
      const config = withRatio(20 + random() * 800, 0.05 + random() * 3, 0.2 + random() * 3);
      const start = { position: random() * 2 - 0.5, velocity: random() * 20 - 10 };
      const a = random() * 0.1;
      const b = random() * 0.1;
      const once = stepSpring(start, config, 1, a + b);
      const twice = stepSpring(stepSpring(start, config, 1, a), config, 1, b);
      expect(twice.position).toBeCloseTo(once.position, 9);
      expect(twice.velocity).toBeCloseTo(once.velocity, 7);
    }
  });

  it("never gains energy when damped (property)", () => {
    const random = mulberry32(11);
    for (let run = 0; run < 300; run++) {
      const config = withRatio(20 + random() * 800, 0.05 + random() * 3, 0.2 + random() * 3);
      const energy = (state: SpringState) =>
        0.5 * config.stiffness * (state.position - 1) ** 2 +
        0.5 * config.mass * state.velocity ** 2;
      let state = { position: random() * 2 - 0.5, velocity: random() * 20 - 10 };
      for (let step = 0; step < 30; step++) {
        const next = stepSpring(state, config, 1, FRAME);
        expect(energy(next)).toBeLessThanOrEqual(energy(state) * (1 + 1e-12) + 1e-15);
        state = next;
      }
    }
  });

  it("stays finite and lands on the target for a huge dt, even when strongly overdamped", () => {
    for (const config of [withRatio(1000, 10), withRatio(170, 1), withRatio(170, 0.2)]) {
      const state = stepSpring({ position: 0, velocity: 4 }, config, 1, 3600);
      expect(state.position).toBeCloseTo(1, 12);
      expect(state.velocity).toBeCloseTo(0, 12);
    }
  });

  it("is continuous across the critical-damping boundary", () => {
    const start = { position: 0.2, velocity: 1.5 };
    const critical = stepSpring(start, withRatio(170, 1), 1, 0.2);
    for (const ratio of [1 - 1e-9, 1 + 1e-9, 1 - 1e-5, 1 + 1e-5]) {
      const near = stepSpring(start, withRatio(170, ratio), 1, 0.2);
      expect(near.position).toBeCloseTo(critical.position, 4);
      expect(near.velocity).toBeCloseTo(critical.velocity, 3);
    }
  });

  it.each([
    ["a non-finite position", { position: Number.NaN, velocity: 0 }, withRatio(170, 1), 1, FRAME],
    ["a non-finite velocity", { position: 0, velocity: Infinity }, withRatio(170, 1), 1, FRAME],
    ["a non-finite target", AT_REST, withRatio(170, 1), Number.NaN, FRAME],
    ["a negative dt", AT_REST, withRatio(170, 1), 1, -FRAME],
    ["a non-finite dt", AT_REST, withRatio(170, 1), 1, Infinity],
    ["zero stiffness", AT_REST, { stiffness: 0, damping: 1, mass: 1 }, 1, FRAME],
    ["zero mass", AT_REST, { stiffness: 170, damping: 26, mass: 0 }, 1, FRAME],
    ["negative damping", AT_REST, { stiffness: 170, damping: -1, mass: 1 }, 1, FRAME],
  ])("throws RangeError for %s", (_, state, config, target, dt) => {
    expect(() => stepSpring(state, config, target, dt)).toThrow(RangeError);
  });

  it("names every invalid value in its message", () => {
    expect(() => stepSpring(AT_REST, { stiffness: -1, damping: 26, mass: 0 }, 1, FRAME)).toThrow(
      /stiffness is -1.*mass is 0/,
    );
  });
});
