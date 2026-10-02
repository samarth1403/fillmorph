import { interpolate } from "fillmorph";
import { describe, expect, it } from "vitest";
import { square } from "../test-shapes.ts";
import { checkArrivedShape } from "./arrived-shape.ts";
import { poppedTarget } from "./overshoot-rule.ts";
import { runPlayback } from "./runner.ts";

const from = [square("c0", null, 0, 30, 50, 10)];
const to = [square("c0", null, 0, 70, 50, 20)];
/** Underdamped: overshoots past 1, then swings back below it. */
const bouncy = { stiffness: 300, damping: 12, mass: 1 };

describe("checkArrivedShape", () => {
  it("passes core's playback: after arriving, every frame is the target, popped", () => {
    const trace = runPlayback({ config: bouncy, from, to, duration: 2 });
    const result = checkArrivedShape(trace);
    expect(result.passed).toBe(true);
    // The trace really does swing back below 1 after arriving.
    const firstArrival = trace.entries.findIndex((entry) => entry.position >= 1);
    expect(trace.entries.slice(firstArrival).some((entry) => entry.position < 1)).toBe(true);
  });

  it("flags frames that interpolate from `from` again on the swing back below 1 (the old bug)", () => {
    const trace = runPlayback({ config: bouncy, from, to, duration: 2 });
    // Injected fault: draw by position alone, as spec 05 did before its fourth reopen.
    const byPosition = {
      ...trace,
      entries: trace.entries.map((entry) => ({
        ...entry,
        contours:
          entry.position >= 1
            ? poppedTarget(to, entry.position)
            : interpolate(from, to, Math.max(0, entry.position)),
      })),
    };
    const result = checkArrivedShape(byPosition);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toMatch(/after the leg arrived, the shape is off/);
  });

  it("notes when no leg reached 1 before settling (a spring that doesn't overshoot)", () => {
    const trace = runPlayback({
      config: { stiffness: 170, damping: 26, mass: 1 },
      from,
      to,
      duration: 2,
    });
    const result = checkArrivedShape(trace);
    expect(result.passed).toBe(true);
  });
});
