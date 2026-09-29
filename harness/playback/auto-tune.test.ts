import { describe, expect, it } from "vitest";
import { naiveMorph } from "../morph-fn.ts";
import { square } from "../test-shapes.ts";
import { autoTuneSpring } from "./auto-tune.ts";
import { runPlayback } from "./runner.ts";
import { dampedStubStep, undampedStubStep } from "./stub-steps.ts";
import { checkSettling, checkVelocityContinuity } from "./timing-checks.ts";

const playback = {
  step: dampedStubStep,
  morph: naiveMorph,
  from: [square("c0", null, 0, 30, 50, 10)],
  to: [square("c0", null, 0, 70, 50, 10)],
  duration: 3,
  interruption: { atTime: 0.2, to: [square("c0", null, 0, 50, 90, 10)] },
};

describe("autoTuneSpring", () => {
  it("keeps a starting config that already passes, unchanged", () => {
    const base = { stiffness: 170, damping: 26, mass: 1 };
    const result = autoTuneSpring({ base, playback });
    expect(result).toMatchObject({ config: base, baseConfigPassed: true });
    expect(result.candidates).toHaveLength(1);
  });

  it("runs end to end on a stand-in and returns a config that passes the settling check", () => {
    const result = autoTuneSpring({ base: { stiffness: 170, damping: 0, mass: 1 }, playback });
    expect(result.baseConfigPassed).toBe(false);
    expect(result.config).not.toBeNull();
    const trace = runPlayback({
      ...playback,
      config: result.config ?? { stiffness: 0, damping: 0, mass: 1 },
    });
    expect(checkSettling(trace).passed).toBe(true);
    expect(checkVelocityContinuity(trace, naiveMorph).passed).toBe(true);
  });

  it("keeps the mass and picks the passing candidate closest to the starting config", () => {
    const result = autoTuneSpring({ base: { stiffness: 170, damping: 0, mass: 2 }, playback });
    expect(result.config?.mass).toBe(2);
    // The closest candidates keep stiffness 170 and add the least damping that settles in time.
    expect(result.config?.stiffness).toBe(170);
  });

  it("is deterministic", () => {
    const options = { base: { stiffness: 170, damping: 0, mass: 1 }, playback };
    expect(autoTuneSpring(options)).toEqual(autoTuneSpring(options));
  });

  it("returns null, not a failing config, when no candidate passes", () => {
    const result = autoTuneSpring({
      base: { stiffness: 170, damping: 26, mass: 1 },
      playback: { ...playback, step: undampedStubStep },
    });
    expect(result.config).toBeNull();
    expect(result.candidates.every((candidate) => !candidate.passed)).toBe(true);
  });
});
