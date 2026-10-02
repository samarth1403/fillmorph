import { type Contour, interpolate } from "fillmorph";
import { describe, expect, it } from "vitest";
import { polygon, square } from "../test-shapes.ts";
import { checkArrivedShape } from "./arrived-shape.ts";
import { runPlayback } from "./runner.ts";
import { checkTraceGeometry, traceFrames } from "./trace-geometry.ts";

const config = { stiffness: 170, damping: 26, mass: 1 };
/** Lightly damped (ζ ≈ 0.31), so the spring overshoots past 1. */
const overshooting = { stiffness: 170, damping: 8, mass: 1 };

describe("checkTraceGeometry", () => {
  it("runs the deliverable #5 checks on every frame of a trace", () => {
    // A trace whose shape self-intersects only after position 0.9, so only late frames can
    // catch it: a real run with those frames' contours swapped for a bowtie.
    const bowtie: Contour = polygon("c0", null, 0, [
      [10, 10],
      [90, 90],
      [90, 10],
      [10, 90],
    ]);
    const clean = runPlayback({
      config,
      from: [square("c0", null, 0, 50, 50, 30)],
      to: [square("c0", null, 0, 50, 50, 40)],
      duration: 1,
    });
    const broken = {
      ...clean,
      entries: clean.entries.map((entry) =>
        entry.position > 0.9 ? { ...entry, contours: [bowtie] } : entry,
      ),
    };

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
    // The hole shrinks to a point at progress 1, and the lightly damped spring overshoots past 1.
    // Core clamps what it draws there (spec 05), so the fault is injected: each frame redrawn at
    // the unclamped position, where interpolate extrapolates the hole inside out and it grows again.
    const from = [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 20)];
    const to = [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 0)];
    const clamped = runPlayback({ config: overshooting, from, to, duration: 3 });
    expect(Math.max(...clamped.entries.map((entry) => entry.position))).toBeGreaterThan(1);
    const unclamped = {
      ...clamped,
      entries: clamped.entries.map((entry) => ({
        ...entry,
        contours: interpolate(from, to, entry.position),
      })),
    };
    // Past 1 the leg has arrived, so the inverted frames are graded by the arrived-shape check
    // (hole-monotonic judges the morph up to arrival): they aren't the target, popped.
    const arrived = checkArrivedShape(unclamped);
    expect(arrived.passed).toBe(false);
    expect(arrived.failures[0]?.message).toMatch(/after the leg arrived/);
  });

  it("judges hole monotonicity over the morph up to arrival, catching a hole that reverses", () => {
    const from = [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 20)];
    const to = [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 0)];
    const trace = runPlayback({ config, from, to, duration: 3 });
    // Injected fault: the hole briefly grows back partway through the morph.
    const reversed = {
      ...trace,
      entries: trace.entries.map((entry) => ({
        ...entry,
        contours:
          entry.position > 0.4 && entry.position < 0.6
            ? interpolate(from, to, 0.1)
            : entry.contours,
      })),
    };
    const [, monotonic] = checkTraceGeometry(reversed);
    expect(monotonic?.passed).toBe(false);
    expect(monotonic?.failures[0]?.message).toContain("leg 1: hole c1 is collapsing to a point");
  });

  it("passes core's clamped version of the same overshoot: the shape holds on the target past 1", () => {
    const trace = runPlayback({
      config: overshooting,
      from: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 20)],
      to: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 0)],
      duration: 3,
    });
    expect(checkTraceGeometry(trace).every((check) => check.passed)).toBe(true);
  });

  it("passes a critically damped version of the same collapse", () => {
    const trace = runPlayback({
      config: { stiffness: 170, damping: 2 * Math.sqrt(170), mass: 1 },
      from: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 20)],
      to: [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 0)],
      duration: 3,
    });
    expect(checkTraceGeometry(trace).every((check) => check.passed)).toBe(true);
  });
});
