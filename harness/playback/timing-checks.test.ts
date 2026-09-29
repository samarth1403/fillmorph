import { describe, expect, it } from "vitest";
import { naiveMorph } from "../morph-fn.ts";
import { square } from "../test-shapes.ts";
import { runPlayback } from "./runner.ts";
import { carryVelocity, dampedStubStep, resetVelocity, undampedStubStep } from "./stub-steps.ts";
import { checkSettling, checkVelocityContinuity, DEFAULT_SETTLING } from "./timing-checks.ts";

// Leg 1 translates a square 40 units right. Wherever the interruption catches it, the retarget
// (centered at 50, 90) is 40–45 units away, so carrying velocity keeps on-screen speed about equal.
const from = [square("c0", null, 0, 30, 50, 10)];
const to = [square("c0", null, 0, 70, 50, 10)];
const retargetTo = [square("c0", null, 0, 50, 90, 10)];
const config = { stiffness: 170, damping: 26, mass: 1 };
const base = { config, morph: naiveMorph, from, to, duration: 3 };

describe("checkSettling", () => {
  it("passes a damped stand-in within the bound, and reports when it settled", () => {
    const result = checkSettling(runPlayback({ ...base, step: dampedStubStep }));
    expect(result.passed).toBe(true);
    expect(result.settleTime).not.toBeNull();
    expect(result.settleTime).toBeLessThanOrEqual(DEFAULT_SETTLING.bound);
  });

  it("flags an undamped stand-in that oscillates forever", () => {
    const result = checkSettling(runPlayback({ ...base, step: undampedStubStep }));
    expect(result.passed).toBe(false);
    expect(result.settleTime).toBeNull();
    expect(result.failures[0]?.message).toContain("never settled");
  });

  it("flags settling that happens, but later than the bound", () => {
    // Overdamped (ζ ≈ 1.6): its slow mode decays at ~1.9/s, reaching 1e-3 after ~3.7 s.
    const sluggish = { stiffness: 30, damping: 18, mass: 1 };
    const result = checkSettling(
      runPlayback({ ...base, config: sluggish, step: dampedStubStep, duration: 8 }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain("past the 2s bound");
  });

  it("measures from the final leg's start when the run was interrupted", () => {
    const trace = runPlayback({
      ...base,
      step: dampedStubStep,
      interruption: { atTime: 0.2, to: retargetTo },
    });
    const result = checkSettling(trace);
    expect(result.passed).toBe(true);
    // Independently: the first entry from which every later one is settled, in absolute time.
    const settled = trace.entries.map(
      (entry) => Math.abs(entry.position - 1) <= 1e-3 && Math.abs(entry.velocity) <= 1e-2,
    );
    const firstSettled = settled.findIndex((_, index) => settled.slice(index).every(Boolean));
    const absolute = trace.entries[firstSettled]?.time ?? Number.NaN;
    expect(result.settleTime).toBeCloseTo(absolute - (trace.legs[1]?.startTime ?? Number.NaN), 12);
    expect(trace.legs[1]?.startTime).toBeGreaterThan(0.19);
  });

  it("fails when the trace is too short to verify the bound", () => {
    const result = checkSettling(runPlayback({ ...base, step: dampedStubStep, duration: 1.5 }));
    expect(result.passed).toBe(false);
    expect(result.failures.at(-1)?.message).toContain("can't be verified");
  });
});

describe("checkVelocityContinuity", () => {
  const interrupted = (mapVelocity: typeof carryVelocity) =>
    runPlayback({
      ...base,
      step: dampedStubStep,
      interruption: { atTime: 0.2, to: retargetTo, mapVelocity },
    });

  it("passes a stand-in whose velocity carries over at the interruption", () => {
    const result = checkVelocityContinuity(interrupted(carryVelocity), naiveMorph);
    expect(result.passed).toBe(true);
    expect(result.notes[0]).toMatch(/speed .* → .* units\/s/);
  });

  it("flags a stand-in that resets velocity to zero at the interruption (a snap)", () => {
    const result = checkVelocityContinuity(interrupted(resetVelocity), naiveMorph);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain("on-screen speed jumps");
    expect(result.failures[0]?.frameIndices).toHaveLength(2);
  });

  it("judges on-screen speed, so a mapping that ignores the new leg's distance is flagged", () => {
    // Leg 1 moves 40 units per unit of progress; the retarget is ~160 units from the snapshot, so
    // carrying progress velocity unchanged makes the shape suddenly move ~4× faster on screen.
    const farther = [square("c0", null, 0, 50, 210, 10)];
    const trace = runPlayback({
      ...base,
      step: dampedStubStep,
      interruption: { atTime: 0.2, to: farther },
    });
    expect(checkVelocityContinuity(trace, naiveMorph).passed).toBe(false);
  });

  it("passes with a note when the trace has no interruption", () => {
    const result = checkVelocityContinuity(
      runPlayback({ ...base, step: dampedStubStep }),
      naiveMorph,
    );
    expect(result.passed).toBe(true);
    expect(result.notes).toEqual(["no interruption in this trace; nothing to check"]);
  });
});
