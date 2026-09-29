import { afterEach, describe, expect, it, vi } from "vitest";
import { naiveMorph } from "../morph-fn.ts";
import { square } from "../test-shapes.ts";
import { type InterruptionContext, runPlayback } from "./runner.ts";
import { dampedStubStep, resetVelocity } from "./stub-steps.ts";

const from = [square("c0", null, 0, 30, 50, 10)];
const to = [square("c0", null, 0, 70, 50, 10)];
const retargetTo = [square("c0", null, 0, 50, 90, 10)];
const config = { stiffness: 170, damping: 26, mass: 1 };
const base = { step: dampedStubStep, config, morph: naiveMorph, from, to, duration: 1, dt: 0.01 };

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

  it("calls the pluggable step function once per step with the config, target 1 and dt", () => {
    const step = vi.fn(dampedStubStep);
    runPlayback({ ...base, step, duration: 0.05 });
    expect(step).toHaveBeenCalledTimes(5);
    expect(step).toHaveBeenNthCalledWith(1, { position: 0, velocity: 0 }, config, 1, 0.01);
  });

  it("records each entry's contours from the MorphFn at that position", () => {
    const trace = runPlayback(base);
    for (const entry of trace.entries.slice(0, 10)) {
      expect(entry.contours).toEqual(naiveMorph(from, to, entry.position));
    }
  });

  it("on interruption: snapshot becomes the new from, position resets to 0, velocity carries over", () => {
    const trace = runPlayback({ ...base, interruption: { atTime: 0.2, to: retargetTo } });
    const [interruption] = trace.interruptions;
    if (interruption === undefined) throw new Error("no interruption recorded");
    const atInstant = trace.entries.filter((entry) => entry.time === interruption.time);

    expect(interruption.time).toBeCloseTo(0.2, 12);
    expect(atInstant.map((entry) => entry.leg)).toEqual([0, 1]);
    const [oldEnd, newStart] = atInstant as [(typeof atInstant)[0], (typeof atInstant)[0]];
    expect(trace.legs[1]?.from).toEqual(oldEnd.contours);
    expect(trace.legs[1]?.to).toEqual(retargetTo);
    expect(newStart.position).toBe(0);
    expect(newStart.velocity).toBe(oldEnd.velocity);
    expect(interruption.velocityBefore).toBeGreaterThan(0);
    expect(trace.entries.at(-1)?.leg).toBe(1);
  });

  it("passes the old velocity and interruption context through a pluggable velocity mapping", () => {
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
    expect(seen[0]?.snapshot).toEqual(naiveMorph(from, to, interruption?.positionBefore ?? 0));
    expect(
      runPlayback({
        ...base,
        interruption: { atTime: 0.2, to: retargetTo, mapVelocity: resetVelocity },
      }).interruptions[0]?.velocityAfter,
    ).toBe(0);
  });

  it("rejects a non-positive dt or duration, and an interruption outside the run", () => {
    expect(() => runPlayback({ ...base, dt: 0 })).toThrow(RangeError);
    expect(() => runPlayback({ ...base, duration: -1 })).toThrow(RangeError);
    expect(() => runPlayback({ ...base, interruption: { atTime: 2, to: retargetTo } })).toThrow(
      RangeError,
    );
  });
});
