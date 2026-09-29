import type { Contour } from "fillmorph";
import { describe, expect, it } from "vitest";
import type { MorphFn } from "../morph-fn.ts";
import { naiveMorph } from "../morph-fn.ts";
import { polygon, square } from "../test-shapes.ts";
import { runPlayback } from "./runner.ts";
import { dampedStubStep } from "./stub-steps.ts";
import { checkTraceGeometry, traceFrames } from "./trace-geometry.ts";

const config = { stiffness: 170, damping: 26, mass: 1 };

describe("checkTraceGeometry", () => {
  it("runs the deliverable #5 checks on every frame of a stub trace", () => {
    // A MorphFn that self-intersects only after position 0.9, so only late frames can catch it.
    const bowtie: Contour = polygon("c0", null, 0, [
      [10, 10],
      [90, 90],
      [90, 10],
      [10, 90],
    ]);
    const lateBreak: MorphFn = (from, to, progress) =>
      progress > 0.9 ? [bowtie] : naiveMorph(from, to, progress);
    const broken = runPlayback({
      step: dampedStubStep,
      config,
      morph: lateBreak,
      from: [square("c0", null, 0, 50, 50, 30)],
      to: [square("c0", null, 0, 50, 50, 40)],
      duration: 1,
    });

    const [selfIntersection] = checkTraceGeometry(broken);
    const flagged = selfIntersection?.failures.flatMap((failure) => failure.frameIndices) ?? [];
    const expected = broken.entries.flatMap((entry, index) =>
      entry.position > 0.9 ? [index] : [],
    );
    expect(flagged).toEqual(expected);
    expect(expected.length).toBeGreaterThan(10);
    expect(traceFrames(broken)).toHaveLength(broken.entries.length);
    expect(selfIntersection?.failures[0]?.message).toMatch(/^t=\d/);
  });

  it("judges hole monotonicity per leg, in progress order, catching an overshoot that inverts a closed hole", () => {
    // The hole shrinks to a point at progress 1; the lightly damped spring overshoots past 1,
    // where the stub's lerp extrapolates the hole inside out and it grows again.
    const trace = runPlayback({
      step: dampedStubStep,
      config: { stiffness: 170, damping: 8, mass: 1 },
      morph: naiveMorph,
      from: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 20)],
      to: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 0)],
      duration: 3,
    });
    expect(Math.max(...trace.entries.map((entry) => entry.position))).toBeGreaterThan(1);
    const [, monotonic] = checkTraceGeometry(trace);
    expect(monotonic?.passed).toBe(false);
    expect(monotonic?.failures[0]?.message).toContain("leg 1: hole c1 is collapsing to a point");
  });

  it("passes a critically damped version of the same collapse", () => {
    const trace = runPlayback({
      step: dampedStubStep,
      config: { stiffness: 170, damping: 2 * Math.sqrt(170), mass: 1 },
      morph: naiveMorph,
      from: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 20)],
      to: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 0)],
      duration: 3,
    });
    expect(checkTraceGeometry(trace).every((check) => check.passed)).toBe(true);
  });
});
