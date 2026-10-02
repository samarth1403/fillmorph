import { describe, expect, it } from "vitest";
import type { Contour } from "../contour";
import { interpolate } from "../morph/interpolate";
import { rectangle } from "../morph/test-helpers";
import { advanceMorph, type MorphState, retargetMorph, startMorph } from "./morph-state";
import { stepSpring } from "./step-spring";
import { popContours } from "./overshoot";
import { overshootRate, visibleRate } from "./visible-rate";

const CONFIG = { stiffness: 170, damping: 26, mass: 1 };
/** Underdamped (ζ ≈ 0.29), so the spring overshoots its target. */
const BOUNCY = { stiffness: 300, damping: 10, mass: 1 };
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
      hasArrived: false,
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

  it("interpolates until the spring first reaches 1, then draws only the popped target", () => {
    // ζ ≈ 0.29: overshoots by about 40%, then swings back below 1 more than once. Unclamped, the
    // ring's hole would turn inside out; interpolating again on the swing back would slide the
    // shape toward `from` mid-bounce (the bug spec 05's fourth reopen fixed).
    let state = startMorph(RING, TO);
    let arrivedAt: number | null = null;
    let undershootFrames = 0;
    for (let step = 0; step < 180 && !state.isSettled; step++) {
      state = advanceMorph(state, BOUNCY, FRAME);
      if (state.isSettled) break;
      const { position } = state.spring;
      if (arrivedAt === null && position >= 1) arrivedAt = step;
      expect(state.hasArrived).toBe(arrivedAt !== null);
      if (arrivedAt === null) {
        expect(state.contours).toEqual(interpolate(RING, TO, position));
      } else {
        expect(state.contours).toEqual(popContours(TO, position));
        if (position < 1) undershootFrames++;
      }
    }
    expect(arrivedAt).not.toBeNull();
    expect(undershootFrames).toBeGreaterThan(5);
  });

  it("never brings `from` back after arriving: an undershoot draws the target slightly shrunk", () => {
    let state = startMorph(FROM, TO);
    while (state.spring.position < 1) state = advanceMorph(state, BOUNCY, FRAME);
    while (state.spring.position >= 1) state = advanceMorph(state, BOUNCY, FRAME);
    // Swinging back below 1 now: the box stays at TO's place, a little smaller.
    expect(state.spring.position).toBeLessThan(1);
    const xs = (state.contours[0]?.points ?? []).map((point) => point.x);
    expect(Math.min(...xs)).toBeGreaterThan(100);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(10);
  });

  it("holds the shape on `from` while the spring is below 0", () => {
    const backwards = { ...startMorph(FROM, TO), spring: { position: 0, velocity: -5 } };
    const state = advanceMorph(backwards, CONFIG, FRAME);
    expect(state.spring.position).toBeLessThan(0);
    expect(state.contours).toEqual(interpolate(FROM, TO, 0));
  });

  it("throws RangeError for an invalid config or dt", () => {
    const start = startMorph(FROM, TO);
    expect(() => advanceMorph(start, { ...CONFIG, mass: 0 }, FRAME)).toThrow(RangeError);
    expect(() => advanceMorph(start, CONFIG, -1)).toThrow(RangeError);
  });
});

describe("retargetMorph", () => {
  const RETARGET = [box(0, 100)];
  /** How far right the box is on screen: the leg from FROM to TO only moves it along x. */
  const offsetX = (state: MorphState): number => state.contours[0]?.points[0]?.x ?? Number.NaN;

  it("starts a new leg from the on-screen snapshot at position 0", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const retargeted = retargetMorph(moving, RETARGET, CONFIG);
    expect(retargeted.from).toBe(moving.contours);
    expect(retargeted.to).toBe(RETARGET);
    expect(retargeted.spring.position).toBe(0);
    expect(retargeted.contours).toEqual(interpolate(moving.contours, RETARGET, 0));
    expect(retargeted.isSettled).toBe(false);
  });

  it("converts the velocity so the visible speed carries over, not the progress number", () => {
    // A square moved by d per unit of progress has visible rate |d|/√2, whatever the direction.
    // Leg 1 moves the box 100 right; the new leg moves it from x to (0, 100): |d| = √(x² + 100²).
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const x = offsetX(moving);
    const retargeted = retargetMorph(moving, RETARGET, CONFIG);
    const expected = (moving.spring.velocity * 100) / Math.hypot(x, 100);
    expect(retargeted.spring.velocity).toBeCloseTo(expected, 6);
    expect(retargeted.spring.velocity).toBeLessThan(moving.spring.velocity);
  });

  it("continues the same motion when retargeting to the target already approached", () => {
    // Spec 05's logged same-target slowdown: the new leg covers only the remaining 1 − p, so the
    // velocity scales by 1/(1 − p), and a spring's motion scales exactly, so the shape follows the
    // path it would have taken uninterrupted.
    const moving = advanceFor(startMorph(FROM, TO), 0.2);
    const p = moving.spring.position;
    const retargeted = retargetMorph(moving, TO, CONFIG);
    expect(retargeted.spring.velocity).toBeCloseTo(moving.spring.velocity / (1 - p), 6);
    let interrupted = retargeted;
    let uninterrupted = moving;
    for (let step = 0; step < 12; step++) {
      interrupted = advanceMorph(interrupted, CONFIG, FRAME);
      uninterrupted = advanceMorph(uninterrupted, CONFIG, FRAME);
      expect(offsetX(interrupted)).toBeCloseTo(offsetX(uninterrupted), 6);
    }
  });

  it("caps the velocity at √(stiffness / mass) for a target almost where the shape already is", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const x = offsetX(moving);
    // The new leg moves the box 0.05 units: matching the old visible speed would need about
    // 100/0.05 = 2000 times the velocity.
    const nearby = retargetMorph(moving, [box(x + 0.05, 0)], CONFIG);
    expect(nearby.spring.velocity).toBe(Math.sqrt(CONFIG.stiffness / CONFIG.mass));
    // A target exactly where the shape is gives the cap too, not Infinity or NaN.
    const same = retargetMorph(moving, [box(x, 0)], CONFIG);
    expect(same.spring.velocity).toBe(Math.sqrt(CONFIG.stiffness / CONFIG.mass));
  });

  it("keeps the velocity's sign, capping its size", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const backwards = {
      ...moving,
      spring: { ...moving.spring, velocity: -moving.spring.velocity },
    };
    const converted = retargetMorph(moving, RETARGET, CONFIG).spring.velocity;
    expect(retargetMorph(backwards, RETARGET, CONFIG).spring.velocity).toBeCloseTo(-converted, 12);
  });

  it("gives 0 when the old leg wasn't visibly moving", () => {
    // From a box to the same box: the spring moves, the shape doesn't.
    const moving = advanceFor(startMorph(FROM, FROM), 0.1);
    expect(moving.spring.velocity).toBeGreaterThan(1);
    expect(retargetMorph(moving, RETARGET, CONFIG).spring.velocity).toBe(0);
    // Even when the new leg doesn't move the shape either: 0, not the cap.
    expect(retargetMorph(moving, FROM, CONFIG).spring.velocity).toBe(0);
  });

  it("carries the overshoot pop's visible speed when retargeting past 1", () => {
    let state = startMorph(FROM, TO);
    while (state.spring.position <= 1.05) state = advanceMorph(state, BOUNCY, FRAME);
    const { position, velocity } = state.spring;
    const retargeted = retargetMorph(state, RETARGET, BOUNCY);
    const expected =
      (Math.abs(velocity) * overshootRate(TO, position)) / visibleRate(state.contours, RETARGET, 0);
    expect(overshootRate(TO, position)).toBeGreaterThan(0);
    expect(retargeted.spring.velocity).toBeCloseTo(Math.sign(velocity) * expected, 10);
    expect(retargeted.from).toBe(state.contours);
  });

  it("carries the pop's visible speed when retargeting mid-bounce below 1, after arriving", () => {
    let state = startMorph(FROM, TO);
    while (state.spring.position < 1) state = advanceMorph(state, BOUNCY, FRAME);
    while (state.spring.position >= 1) state = advanceMorph(state, BOUNCY, FRAME);
    state = advanceMorph(state, BOUNCY, FRAME);
    const { position, velocity } = state.spring;
    expect(state.hasArrived).toBe(true);
    expect(position).toBeLessThan(1);
    const expected =
      (Math.abs(velocity) * overshootRate(TO, position)) / visibleRate(state.contours, RETARGET, 0);
    const retargeted = retargetMorph(state, RETARGET, BOUNCY);
    expect(retargeted.spring.velocity).toBeCloseTo(Math.sign(velocity) * expected, 10);
    // The new leg starts unarrived, interpolating from the snapshot.
    expect(retargeted.hasArrived).toBe(false);
  });

  it("gives 0 below position 0, where the shape is held still", () => {
    const backwards = { ...startMorph(FROM, TO), spring: { position: -0.1, velocity: -2 } };
    expect(retargetMorph(backwards, RETARGET, BOUNCY).spring.velocity).toBe(0);
  });

  it("measures each leg's visible rate where the retarget happens: the old at its position, the new at 0", () => {
    // Square → long thin bar: the outline's directions change along the way, so this leg's visible
    // rate at its start differs from its rate at the end.
    const bar: Contour[] = [
      {
        id: "c0",
        parentId: null,
        isHole: false,
        depth: 0,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 100, y: 1 },
          { x: 100, y: 0 },
        ],
      },
    ];
    const moving = advanceFor(startMorph(FROM, TO), 0.25);
    const atStart = visibleRate(moving.contours, bar, 0);
    expect(Math.abs(atStart - visibleRate(moving.contours, bar, 1)) / atStart).toBeGreaterThan(0.1);
    const expected =
      (moving.spring.velocity * visibleRate(FROM, TO, moving.spring.position)) / atStart;
    // Below the cap, so this measures the conversion, not the cap.
    expect(expected).toBeLessThan(Math.sqrt(CONFIG.stiffness / CONFIG.mass));
    expect(retargetMorph(moving, bar, CONFIG).spring.velocity).toBeCloseTo(expected, 12);
  });

  it("shows the same shape the instant it retargets: no jump", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const snapshot = moving.contours[0]?.points ?? [];
    const after = retargetMorph(moving, RETARGET, CONFIG).contours[0]?.points ?? [];
    expect(after).toHaveLength(snapshot.length);
    for (const point of after) {
      expect(snapshot.some((corner) => corner.x === point.x && corner.y === point.y)).toBe(true);
    }
  });

  it("chains: each retarget applies the same rule, and the last target is reached", () => {
    let state = startMorph(FROM, TO);
    for (const target of [[box(0, 100)], [box(50, 50)], [box(-20, 10)]]) {
      state = advanceFor(state, 0.1);
      const retargeted = retargetMorph(state, target, CONFIG);
      expect(retargeted.from).toBe(state.contours);
      expect(Number.isFinite(retargeted.spring.velocity)).toBe(true);
      expect(retargeted.spring.velocity).toBeGreaterThan(0);
      state = retargeted;
    }
    expect(advanceFor(state, 3).contours).toEqual([box(-20, 10)]);
  });

  it("restarts from rest on a settled morph", () => {
    const settled = advanceFor(startMorph(FROM, TO), 3);
    const retargeted = retargetMorph(settled, RETARGET, CONFIG);
    expect(retargeted.from).toBe(TO);
    expect(retargeted.spring).toEqual({ position: 0, velocity: 0 });
  });

  it("throws for an incoherent target, leaving the given state untouched", () => {
    const moving = advanceFor(startMorph(FROM, TO), 0.1);
    const copy = JSON.parse(JSON.stringify(moving));
    expect(() =>
      retargetMorph(moving, [{ ...box(0, 0), parentId: "x", depth: 1 }], CONFIG),
    ).toThrow(TypeError);
    expect(moving).toEqual(copy);
  });
});
