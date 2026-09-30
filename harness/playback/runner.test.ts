import { advanceMorph, retargetMorph, startMorph } from "fillmorph";
import { afterEach, describe, expect, it, vi } from "vitest";
import { square } from "../test-shapes.ts";
import { type InterruptionContext, runPlayback } from "./runner.ts";

const from = [square("c0", null, 0, 30, 50, 10)];
const to = [square("c0", null, 0, 70, 50, 10)];
const retargetTo = [square("c0", null, 0, 50, 90, 10)];
const config = { stiffness: 170, damping: 26, mass: 1 };
const base = { config, from, to, duration: 1, dt: 0.01 };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("runPlayback", () => {
  it("produces an identical trace for identical inputs", () => {
    const options = { ...base, interruption: { atTime: 0.2, to: retargetTo } };
    expect(runPlayback(options)).toEqual(runPlayback(options));
  });

  it("runs on a simulated clock: synchronous, no timers, no wall-clock reads", () => {
    vi.useFakeTimers();
    const now = vi.spyOn(Date, "now");
    const trace = runPlayback(base);
    expect(vi.getTimerCount()).toBe(0);
    expect(now).not.toHaveBeenCalled();
    expect(trace.entries.map((entry) => entry.time)).toEqual(
      Array.from({ length: 101 }, (_, index) => index * 0.01),
    );
  });

  it("records exactly core's startMorph / advanceMorph states, step by step", () => {
    const trace = runPlayback(base);
    let state = startMorph(from, to);
    for (const [index, entry] of trace.entries.entries()) {
      if (index > 0) state = advanceMorph(state, config, 0.01);
      expect(entry).toMatchObject({
        position: state.spring.position,
        velocity: state.spring.velocity,
        contours: state.contours,
      });
    }
  });

  it("records the settled state: position exactly 1 and the exact target shape", () => {
    const trace = runPlayback(base);
    const last = trace.entries.at(-1);
    expect(last?.position).toBe(1);
    expect(last?.velocity).toBe(0);
    expect(last?.contours).toBe(to);
  });

  it("on interruption: records core's retargetMorph on both sides of the same instant", () => {
    const trace = runPlayback({ ...base, interruption: { atTime: 0.2, to: retargetTo } });
    const [interruption] = trace.interruptions;
    if (interruption === undefined) throw new Error("no interruption recorded");
    const atInstant = trace.entries.filter((entry) => entry.time === interruption.time);

    expect(interruption.time).toBeCloseTo(0.2, 12);
    expect(atInstant.map((entry) => entry.leg)).toEqual([0, 1]);
    const [oldEnd, newStart] = atInstant as [(typeof atInstant)[0], (typeof atInstant)[0]];
    let state = startMorph(from, to);
    for (let step = 0; step < 20; step++) state = advanceMorph(state, config, 0.01);
    const retargeted = retargetMorph(state, retargetTo);
    expect(oldEnd.contours).toEqual(state.contours);
    expect(newStart.contours).toEqual(retargeted.contours);
    expect(trace.legs[1]?.from).toEqual(state.contours);
    expect(trace.legs[1]?.to).toBe(retargetTo);
    expect(newStart.position).toBe(0);
    expect(newStart.velocity).toBe(oldEnd.velocity);
    expect(interruption.velocityBefore).toBeGreaterThan(0);
    expect(trace.entries.at(-1)?.leg).toBe(1);
  });

  it("applies a test-only velocity override after retargetMorph, passing it the interruption context", () => {
    const seen: InterruptionContext[] = [];
    const trace = runPlayback({
      ...base,
      interruption: {
        atTime: 0.2,
        to: retargetTo,
        mapVelocity: (velocity, context) => {
          seen.push(context);
          return velocity * 0.5;
        },
      },
    });
    const [interruption] = trace.interruptions;
    expect(interruption?.velocityAfter).toBe((interruption?.velocityBefore ?? 0) * 0.5);
    expect(seen[0]?.oldFrom).toBe(from);
    expect(seen[0]?.newTo).toBe(retargetTo);
    expect(seen[0]?.snapshot).toEqual(trace.legs[1]?.from);
  });

  it("rejects a non-positive dt or duration, and an interruption outside the run", () => {
    expect(() => runPlayback({ ...base, dt: 0 })).toThrow(RangeError);
    expect(() => runPlayback({ ...base, duration: -1 })).toThrow(RangeError);
    expect(() => runPlayback({ ...base, interruption: { atTime: 2, to: retargetTo } })).toThrow(
      RangeError,
    );
  });
});
