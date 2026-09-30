import { describe, expect, it } from "vitest";
import type { Contour } from "../contour";
import { interpolate } from "../morph/interpolate";
import { rectangle } from "../morph/test-helpers";
import { advanceMorph, type MorphState, retargetMorph, startMorph } from "./morph-state";
import { stepSpring } from "./step-spring";

const CONFIG = { stiffness: 170, damping: 26, mass: 1 };
const FRAME = 1 / 60;

function box(x: number, y: number, size = 10): Contour {
  return { id: "c0", parentId: null, isHole: false, depth: 0, points: rectangle(x, y, size, size) };
}

/** An outline with a hole, so a morph to a plain box has a hole that disappears. */
const RING: Contour[] = [
  box(20, 20, 60),
  { id: "c1", parentId: "c0", isHole: true, depth: 1, points: rectangle(40, 40, 20, 20).reverse() },
];
const FROM = [box(0, 0)];
const TO = [box(100, 0)];

function advanceFor(state: MorphState, seconds: number): MorphState {
  let next = state;
  for (let step = 0; step < Math.round(seconds / FRAME); step++) {
    next = advanceMorph(next, CONFIG, FRAME);
  }
  return next;
}

describe("startMorph", () => {
  it("starts at rest at position 0, showing `from`", () => {
    const state = startMorph(FROM, TO);
    expect(state).toEqual({
      from: FROM,
      to: TO,
      spring: { position: 0, velocity: 0 },
      contours: interpolate(FROM, TO, 0),
      isSettled: false,
    });
  });

  it("throws for an incoherent contour tree", () => {
    const orphan = [{ ...box(0, 0), parentId: "missing", depth: 1 }];
    expect(() => startMorph(FROM, orphan)).toThrow(TypeError);
  });
});

describe("advanceMorph", () => {
  it("steps the spring with stepSpring and shows interpolate at the new position", () => {
    const state = advanceMorph(startMorph(FROM, TO), CONFIG, FRAME);
    const spring = stepSpring({ position: 0, velocity: 0 }, CONFIG, 1, FRAME);
    expect(state.spring).toEqual(spring);
    expect(state.contours).toEqual(interpolate(FROM, TO, spring.position));
    expect(state.isSettled).toBe(false);
  });

  it("does not mutate the state it's given", () => {
    const start = startMorph(FROM, TO);
    const copy = JSON.parse(JSON.stringify(start));
    advanceMorph(start, CONFIG, FRAME);
    expect(start).toEqual(copy);
  });

  it("settles on exactly 1 at rest and shows the exact target, without placeholder contours", () => {
    const settled = advanceFor(startMorph(RING, TO), 3);
    expect(settled.isSettled).toBe(true);
    expect(settled.spring).toEqual({ position: 1, velocity: 0 });
    expect(settled.contours).toBe(TO);
    // Just before settling, the vanished hole was still there as a zero-area placeholder.
    expect(interpolate(RING, TO, 1).map((contour) => contour.id)).toEqual(["c0", "c1"]);
  });

  it("stays settled", () => {
    const settled = advanceFor(startMorph(FROM, TO), 3);
    expect(advanceMorph(settled, CONFIG, FRAME)).toEqual(settled);
  });

  it("throws RangeError for an invalid config or dt", () => {
    const start = startMorph(FROM, TO);
    expect(() => advanceMorph(start, { ...CONFIG, mass: 0 }, FRAME)).toThrow(RangeError);
    expect(() => advanceMorph(start, CONFIG, -1)).toThrow(RangeError);
  });
});

describe("retargetMorph", () => {
  const RETARGET = [box(0, 100)];

  it("starts a new leg from the on-screen snapshot, position 0, velocity carried unchanged", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const retargeted = retargetMorph(moving, RETARGET);
    expect(retargeted.from).toBe(moving.contours);
    expect(retargeted.to).toBe(RETARGET);
    expect(retargeted.spring).toEqual({ position: 0, velocity: moving.spring.velocity });
    expect(moving.spring.velocity).toBeGreaterThan(1);
    expect(retargeted.contours).toEqual(interpolate(moving.contours, RETARGET, 0));
    expect(retargeted.isSettled).toBe(false);
  });

  it("shows the same shape the instant it retargets: no jump", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const snapshot = moving.contours[0]?.points ?? [];
    const after = retargetMorph(moving, RETARGET).contours[0]?.points ?? [];
    expect(after).toHaveLength(snapshot.length);
    for (const point of after) {
      expect(snapshot.some((corner) => corner.x === point.x && corner.y === point.y)).toBe(true);
    }
  });

  it("chains: each retarget applies the same rule, and the last target is reached", () => {
    let state = startMorph(FROM, TO);
    for (const target of [[box(0, 100)], [box(50, 50)], [box(-20, 10)]]) {
      state = advanceFor(state, 0.1);
      const retargeted = retargetMorph(state, target);
      expect(retargeted.from).toBe(state.contours);
      expect(retargeted.spring.velocity).toBe(state.spring.velocity);
      state = retargeted;
    }
    expect(advanceFor(state, 3).contours).toEqual([box(-20, 10)]);
  });

  it("restarts from rest on a settled morph", () => {
    const settled = advanceFor(startMorph(FROM, TO), 3);
    const retargeted = retargetMorph(settled, RETARGET);
    expect(retargeted.from).toBe(TO);
    expect(retargeted.spring).toEqual({ position: 0, velocity: 0 });
  });

  it("throws for an incoherent target, leaving the given state untouched", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const copy = JSON.parse(JSON.stringify(moving));
    expect(() => retargetMorph(moving, [{ ...box(0, 0), parentId: "x", depth: 1 }])).toThrow(
      TypeError,
    );
    expect(moving).toEqual(copy);
  });
});
