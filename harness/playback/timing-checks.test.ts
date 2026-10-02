import { describe, expect, it } from "vitest";
import type { Contour } from "fillmorph";
import { square } from "../test-shapes.ts";
import { runPlayback, type VelocityMapping } from "./runner.ts";
import {
  checkPositionContinuity,
  checkSettling,
  checkVelocityContinuity,
  DEFAULT_SETTLING,
  outlineDisplacement,
} from "./timing-checks.ts";

// Leg 1 translates a square 40 units right. Wherever the interruption catches it, the retarget
// (centered at 50, 90) is 40–45 units away, so carrying velocity keeps on-screen speed about equal.
const from = [square("c0", null, 0, 30, 50, 10)];
const to = [square("c0", null, 0, 70, 50, 10)];
const retargetTo = [square("c0", null, 0, 50, 90, 10)];
const config = { stiffness: 170, damping: 26, mass: 1 };
const base = { config, from, to, duration: 3 };
/** Fault injection: a retarget that drops the velocity, i.e. a visible snap. */
const resetVelocity: VelocityMapping = () => 0;

describe("checkSettling", () => {
  it("passes a damped spring within the bound, and reports when it settled", () => {
    const result = checkSettling(runPlayback(base));
    expect(result.passed).toBe(true);
    expect(result.settleTime).not.toBeNull();
    expect(result.settleTime).toBeLessThanOrEqual(DEFAULT_SETTLING.bound);
  });

  it("flags an undamped spring that oscillates forever", () => {
    const result = checkSettling(runPlayback({ ...base, config: { ...config, damping: 0 } }));
    expect(result.passed).toBe(false);
    expect(result.settleTime).toBeNull();
    expect(result.failures[0]?.message).toContain("never settled");
  });

  it("flags settling that happens, but later than the bound", () => {
    // Overdamped (ζ ≈ 1.6): its slow mode decays at ~1.9/s, reaching 1e-3 after ~3.7 s.
    const sluggish = { stiffness: 30, damping: 18, mass: 1 };
    const result = checkSettling(runPlayback({ ...base, config: sluggish, duration: 8 }));
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain("past the 2s bound");
  });

  it("measures from the final leg's start when the run was interrupted", () => {
    const trace = runPlayback({ ...base, interruption: { atTime: 0.2, to: retargetTo } });
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
    const result = checkSettling(runPlayback({ ...base, duration: 1.5 }));
    expect(result.passed).toBe(false);
    expect(result.failures.at(-1)?.message).toContain("can't be verified");
  });
});

describe("checkVelocityContinuity", () => {
  it("passes core's retarget, which carries velocity over at the interruption", () => {
    const result = checkVelocityContinuity(
      runPlayback({ ...base, interruption: { atTime: 0.2, to: retargetTo } }),
    );
    expect(result.passed).toBe(true);
    expect(result.notes[0]).toMatch(/speed .* → .* units\/s/);
  });

  it("flags a retarget whose velocity is reset to zero (a snap), injected as a fault", () => {
    const result = checkVelocityContinuity(
      runPlayback({
        ...base,
        interruption: { atTime: 0.2, to: retargetTo, mapVelocity: resetVelocity },
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain("on-screen speed jumps");
    expect(result.failures[0]?.frameIndices).toHaveLength(2);
  });

  it("judges on-screen speed, so a mapping that ignores the new leg's distance is flagged", () => {
    // Leg 1 moves 40 units per unit of progress; the retarget is ~160 units from the snapshot, so
    // carrying progress velocity unchanged makes the shape suddenly move ~4× faster on screen.
    // That raw carry was spec 05's rule before its reopen; it's injected here as the fault.
    const farther = [square("c0", null, 0, 50, 210, 10)];
    const rawCarry: VelocityMapping = (velocity) => velocity;
    const faulty = runPlayback({
      ...base,
      interruption: { atTime: 0.2, to: farther, mapVelocity: rawCarry },
    });
    expect(checkVelocityContinuity(faulty).passed).toBe(false);
    // Core's own retarget converts the velocity, and passes.
    const converted = runPlayback({ ...base, interruption: { atTime: 0.2, to: farther } });
    expect(checkVelocityContinuity(converted).passed).toBe(true);
  });

  it("judges a retarget during an overshoot by the pop spec 05 draws there, not the unclamped geometry", () => {
    // Underdamped: at 0.2 s the spring is past 1, where spec 05 draws the target slightly scaled.
    const bouncy = { stiffness: 300, damping: 12, mass: 1 };
    const trace = runPlayback({
      ...base,
      config: bouncy,
      interruption: { atTime: 0.2, to: retargetTo },
    });
    expect(trace.interruptions[0]?.positionBefore).toBeGreaterThan(1);
    expect(checkVelocityContinuity(trace).passed).toBe(true);
    // Dropping the pop's speed at the retarget is a snap.
    const dropped = checkVelocityContinuity(
      runPlayback({
        ...base,
        config: bouncy,
        interruption: { atTime: 0.2, to: retargetTo, mapVelocity: resetVelocity },
      }),
    );
    expect(dropped.passed).toBe(false);
  });

  it("judges a retarget on the swing back below 1, after arriving, by the pop drawn there", () => {
    const bouncy = { stiffness: 300, damping: 12, mass: 1 };
    // About 0.35 s in, this underdamped leg has overshot and is swinging back below 1.
    const trace = runPlayback({
      ...base,
      config: bouncy,
      interruption: { atTime: 0.35, to: retargetTo },
    });
    const before = trace.interruptions[0];
    expect(before?.positionBefore).toBeLessThan(1);
    expect(trace.entries.some((entry) => entry.leg === 0 && entry.position >= 1)).toBe(true);
    expect(checkVelocityContinuity(trace).passed).toBe(true);
  });

  it("passes with a note when the trace has no interruption", () => {
    const result = checkVelocityContinuity(runPlayback(base));
    expect(result.passed).toBe(true);
    expect(result.notes).toEqual(["no interruption in this trace; nothing to check"]);
  });
});

describe("outlineDisplacement (the visible part of motion)", () => {
  /** A regular 64-gon of radius `radius` around (50, 50), started `phase` radians round. */
  const circle = (radius: number, phase = 0): Contour[] => [
    {
      id: "c0",
      parentId: null,
      isHole: false,
      depth: 0,
      points: Array.from({ length: 64 }, (_, index) => {
        const angle = phase - (index / 64) * Math.PI * 2;
        return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
      }),
    },
  ];
  const shift = (contours: Contour[], dx: number, dy: number): Contour[] =>
    contours.map((c) => ({ ...c, points: c.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }));

  it("ignores points sliding along an outline that doesn't move", () => {
    // Every vertex moves by up to ~0.98 units (a 1/64 turn of the vertex ring), none of it across
    // the outline, apart from the polygon's own chord sag.
    const step = (Math.PI * 2) / 64 / 2;
    const displacement = outlineDisplacement(circle(20, -step), circle(20), circle(20, step));
    expect(displacement).toBeLessThan(0.02);
  });

  it("measures growth in full: every point moves straight across the outline", () => {
    expect(outlineDisplacement(circle(19), circle(20), circle(21))).toBeCloseTo(2, 9);
  });

  it("counts a translation's across-the-outline part: a circle moved 2 units scores 2/√2", () => {
    // Around a circle, the normal part of a fixed displacement d is d·cos θ, whose RMS is d/√2.
    const now = circle(20);
    const displacement = outlineDisplacement(shift(now, -1, 0), now, shift(now, 1, 0));
    expect(displacement).toBeCloseTo(2 / Math.SQRT2, 3);
  });

  it("weighs a contour by its drawn length, so a point-sized placeholder counts for nothing", () => {
    const dot: Contour = {
      id: "c1",
      parentId: "c0",
      isHole: true,
      depth: 1,
      points: Array.from({ length: 64 }, () => ({ x: 50, y: 50 })),
    };
    const moved = { ...dot, points: dot.points.map(() => ({ x: 60, y: 50 })) };
    expect(
      outlineDisplacement([...circle(19), dot], [...circle(20), dot], [...circle(21), moved]),
    ).toBeCloseTo(2, 9);
  });

  it("weighs by outline length, not point count, so a crowded stretch doesn't dominate", () => {
    // A 10×10 square whose top edge carries 9 extra points, 1 unit apart. Only those 9 move, 2 units
    // straight across the edge: 9 units of a 40-unit outline, so RMS = 2·√(9/40). Counting points
    // instead would give 2·√(9/13).
    const topEdge = Array.from({ length: 9 }, (_, index) => ({ x: 9 - index, y: 0 }));
    const frame = (dy: number): Contour[] => [
      {
        id: "c0",
        parentId: null,
        isHole: false,
        depth: 0,
        points: [
          { x: 10, y: 0 },
          ...topEdge.map((p) => ({ x: p.x, y: p.y + dy })),
          { x: 0, y: 0 },
          { x: 0, y: 10 },
          { x: 10, y: 10 },
        ],
      },
    ];
    expect(outlineDisplacement(frame(1), frame(0), frame(-1))).toBeCloseTo(
      2 * Math.sqrt(9 / 40),
      9,
    );
  });

  it("returns null when the frames' structure differs", () => {
    expect(outlineDisplacement(circle(19), circle(20), [])).toBeNull();
  });
});

describe("checkPositionContinuity", () => {
  const interrupted = (target = retargetTo) =>
    runPlayback({ ...base, interruption: { atTime: 0.2, to: target } });

  /** The trace with the new leg's first frame replaced, to forge a discontinuity. */
  function withFirstFrameAfter(trace: ReturnType<typeof interrupted>, contours: Contour[]) {
    const index = trace.entries.findIndex((entry) => entry.leg === 1);
    return {
      ...trace,
      entries: trace.entries.map((entry, at) => (at === index ? { ...entry, contours } : entry)),
    };
  }

  it("passes core's retarget: the same outline on both sides, to floating-point noise", () => {
    const result = checkPositionContinuity(interrupted());
    expect(result.passed).toBe(true);
    expect(result.notes[0]).toMatch(/^t=0\.2s: outlines 0 units apart$/);
  });

  it("ignores an appearing hole's zero-area placeholder, which draws nothing", () => {
    const ring = [square("c0", null, 0, 50, 90, 10), square("c1", "c0", 1, 50, 90, 4)];
    const trace = interrupted(ring);
    const firstAfter = trace.entries.find((entry) => entry.leg === 1);
    expect(firstAfter?.contours.map((contour) => contour.id)).toEqual(["c0", "c1"]);
    expect(checkPositionContinuity(trace).passed).toBe(true);
  });

  it("flags a new leg whose first frame is somewhere else, naming the time and the distance", () => {
    const trace = interrupted();
    const result = checkPositionContinuity(withFirstFrameAfter(trace, from));
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.frameIndices).toHaveLength(2);
    expect(result.failures[0]?.message).toMatch(
      /^t=0\.2s: the new leg's first frame jumps away from the shape on screen — outlines [\d.]+ units apart at/,
    );
  });

  it("flags a new leg that starts from the wrong `from`, even when its first recorded frame looks right", () => {
    // The old bug: the leg runs from the original icon, not the on-screen snapshot. The frame
    // recorded at the retarget instant is still the snapshot; the jump shows on the next step.
    const trace = interrupted();
    const legs = trace.legs.map((leg) => (leg.index === 1 ? { ...leg, from } : leg));
    const result = checkPositionContinuity({ ...trace, legs });
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toMatch(
      /^t=0\.2s: the new leg's starting shape jumps away from the shape on screen/,
    );
  });

  it("flags a jump just past the tolerance, and passes one just inside it", () => {
    const trace = interrupted();
    const before = trace.entries.filter((entry) => entry.time === trace.interruptions[0]?.time)[0];
    const shifted = (offset: number): Contour[] =>
      (before?.contours ?? []).map((contour) => ({
        ...contour,
        points: contour.points.map((point) => ({ x: point.x + offset, y: point.y })),
      }));
    expect(checkPositionContinuity(withFirstFrameAfter(trace, shifted(0.09))).passed).toBe(true);
    expect(checkPositionContinuity(withFirstFrameAfter(trace, shifted(0.2))).passed).toBe(false);
  });

  it("flags a contour whose fill flips although its outline stays put", () => {
    const trace = interrupted();
    const before = trace.entries.filter((entry) => entry.time === trace.interruptions[0]?.time)[0];
    const reversed = (before?.contours ?? []).map((contour) => ({
      ...contour,
      points: [...contour.points].reverse(),
    }));
    const result = checkPositionContinuity(withFirstFrameAfter(trace, reversed));
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain("fill flipped");
  });

  it("passes with a note when the trace has no interruption", () => {
    const result = checkPositionContinuity(runPlayback(base));
    expect(result.passed).toBe(true);
    expect(result.notes).toEqual(["no interruption in this trace; nothing to check"]);
  });
});
