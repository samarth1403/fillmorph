import {
  advanceMorph,
  type Contour,
  interpolate,
  type Point,
  retargetMorph,
  type SpringConfig,
  type SpringState,
  startMorph,
  stepSpring,
} from "fillmorph";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMorphDriver } from "./morph-driver";

/**
 * A controllable stand-in for `requestAnimationFrame`: callbacks queue up and run only when a
 * test calls `frame(timestamp)`, so the driver's clock is fully deterministic.
 */
function installFakeAnimationFrames() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    pending.delete(id);
  });
  return {
    pendingCount: () => pending.size,
    /** Runs every callback queued so far with `timestamp` (milliseconds). */
    frame(timestamp: number) {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(timestamp);
    },
  };
}

type FakeFrames = ReturnType<typeof installFakeAnimationFrames>;
let frames: FakeFrames;

beforeEach(() => {
  frames = installFakeAnimationFrames();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A 10-unit square at (x, y), counter-clockwise on screen like a parsed outer contour. */
function square(x: number, y: number): Contour[] {
  const points: Point[] = [
    { x, y },
    { x, y: y + 10 },
    { x: x + 10, y: y + 10 },
    { x: x + 10, y },
  ];
  return [{ id: "c0", parentId: null, isHole: false, depth: 0, points }];
}

/** The offset of a (translated) square, read from its first point. */
const firstPoint = (contours: Contour[]) => (contours[0] as Contour).points[0] as Point;
const offsetX = (contours: Contour[]) => firstPoint(contours).x;
const offsetY = (contours: Contour[]) => firstPoint(contours).y;

const CONFIG: SpringConfig = { stiffness: 170, damping: 26, mass: 1 };
const FROM = square(0, 0);
const TO = square(100, 0);

function record(driver: ReturnType<typeof createMorphDriver>): Contour[][] {
  const emitted: Contour[][] = [];
  driver.subscribe((contours) => emitted.push(contours));
  return emitted;
}

/** Runs frames every `stepMs` from `startMs` while the driver keeps requesting them. */
function runUntilIdle(startMs: number, stepMs: number, maxFrames = 10_000): number {
  let time = startMs;
  for (let count = 0; frames.pendingCount() > 0 && count < maxFrames; count++) {
    frames.frame(time);
    time += stepMs;
  }
  return time;
}

describe("createMorphDriver", () => {
  it("gives a new subscriber the current shape immediately", () => {
    const emitted = record(createMorphDriver(FROM, TO, CONFIG));
    expect(emitted).toEqual([interpolate(FROM, TO, 0)]);
  });

  it("steps the spring by the time between animation frames, starting with a zero step", () => {
    const emitted = record(createMorphDriver(FROM, TO, CONFIG));
    let expected: SpringState = { position: 0, velocity: 0 };
    let previous: number | null = null;
    for (const timestamp of [1000, 1016, 1033, 1050, 1090, 1100]) {
      frames.frame(timestamp);
      const dt = previous === null ? 0 : (timestamp - previous) / 1000;
      previous = timestamp;
      expected = stepSpring(expected, CONFIG, 1, dt);
      expect(emitted.at(-1)).toEqual(interpolate(FROM, TO, expected.position));
    }
    expect(offsetX(emitted.at(-1) as Contour[])).toBeGreaterThan(0);
  });

  it("emits exactly core's advanceMorph / retargetMorph sequence (the harness's code path)", () => {
    const driver = createMorphDriver(FROM, TO, CONFIG);
    const emitted = record(driver);
    // Timestamps 16 ms apart make the driver's dt exactly 0.016 s after the first, zero step.
    let expected = advanceMorph(startMorph(FROM, TO), CONFIG, 0);
    frames.frame(0);
    expect(emitted.at(-1)).toEqual(expected.contours);
    for (let index = 1; index <= 12; index++) {
      frames.frame(index * 16);
      expected = advanceMorph(expected, CONFIG, 0.016);
      expect(emitted.at(-1)).toEqual(expected.contours);
    }
    driver.retarget(square(0, 100));
    expected = retargetMorph(expected, square(0, 100));
    for (let index = 13; frames.pendingCount() > 0; index++) {
      frames.frame(index * 16);
      expected = advanceMorph(expected, CONFIG, 0.016);
      expect(emitted.at(-1)).toEqual(expected.contours);
    }
    expect(expected.isSettled).toBe(true);
  });

  it("settles on exactly the target and requests no further frames", () => {
    const emitted = record(createMorphDriver(FROM, TO, CONFIG));
    runUntilIdle(0, 1000 / 60);
    expect(frames.pendingCount()).toBe(0);
    expect(emitted.at(-1)).toBe(TO);
    const count = emitted.length;
    frames.frame(99_999);
    expect(emitted.length).toBe(count);
    // Settles in well under 2 s at 60 fps with the default-like config.
    expect(count).toBeLessThan(2 * 60);
  });

  it("uses a default config when none is given, and still settles", () => {
    const emitted = record(createMorphDriver(FROM, TO));
    runUntilIdle(0, 1000 / 60);
    expect(emitted.at(-1)).toBe(TO);
  });

  it("lands on the target in one frame after a long gap (e.g. a backgrounded tab)", () => {
    const emitted = record(createMorphDriver(FROM, TO, CONFIG));
    frames.frame(0);
    frames.frame(60_000);
    expect(emitted.at(-1)).toBe(TO);
    expect(frames.pendingCount()).toBe(0);
  });

  it("stop() cancels the pending frame, so nothing more runs or is emitted", () => {
    const driver = createMorphDriver(FROM, TO, CONFIG);
    const emitted = record(driver);
    frames.frame(0);
    frames.frame(50);
    const count = emitted.length;
    driver.stop();
    expect(frames.pendingCount()).toBe(0);
    frames.frame(100);
    expect(emitted.length).toBe(count);
  });

  it("unsubscribing stops calls to that listener only", () => {
    const driver = createMorphDriver(FROM, TO, CONFIG);
    const kept: Contour[][] = [];
    const dropped: Contour[][] = [];
    driver.subscribe((contours) => kept.push(contours));
    const unsubscribe = driver.subscribe((contours) => dropped.push(contours));
    unsubscribe();
    frames.frame(0);
    frames.frame(16);
    expect(dropped.length).toBe(1);
    expect(kept.length).toBe(3);
  });

  describe("retarget (interruption)", () => {
    const RETARGET = square(0, 100);
    const FRAME_MS = 0.5;

    /** Runs frames from t = 0 until the square has moved `fraction` of the way to `TO`. */
    function runTo(fraction: number, emitted: Contour[][]): number {
      let time = 0;
      while (offsetX(emitted.at(-1) as Contour[]) < fraction * 100) {
        frames.frame(time);
        time += FRAME_MS;
      }
      return time;
    }

    it("starts the new leg from the on-screen snapshot, with velocity carried over", () => {
      const driver = createMorphDriver(FROM, TO, CONFIG);
      const emitted = record(driver);
      let time = runTo(0.4, emitted);
      const snapshot = emitted.at(-1) as Contour[];

      // Recover the old leg's state by replaying the same frames through stepSpring.
      let state: SpringState = { position: 0, velocity: 0 };
      for (let t = FRAME_MS; t < time; t += FRAME_MS) {
        state = stepSpring(state, CONFIG, 1, FRAME_MS / 1000);
      }
      expect(interpolate(FROM, TO, state.position)).toEqual(snapshot);
      expect(state.position).toBeGreaterThan(0.38);
      expect(state.position).toBeLessThan(0.42);

      driver.retarget(RETARGET);
      frames.frame(time);
      // (a) The new leg runs from the snapshot to the new target, position reset to 0, and
      // (b) its spring starts from the old leg's velocity.
      const next = stepSpring(
        { position: 0, velocity: state.velocity },
        CONFIG,
        1,
        FRAME_MS / 1000,
      );
      expect(emitted.at(-1)).toEqual(interpolate(snapshot, RETARGET, next.position));
      time += FRAME_MS;

      runUntilIdle(time, 1000 / 60);
      expect(emitted.at(-1)).toBe(RETARGET);
      expect(frames.pendingCount()).toBe(0);
    });

    it("keeps progress velocity continuous across the interruption, measured from the output", () => {
      const driver = createMorphDriver(FROM, TO, CONFIG);
      const emitted = record(driver);
      let time = runTo(0.4, emitted);
      const [older, newer] = emitted.slice(-2) as [Contour[], Contour[]];
      // Leg 1 moves the square 100 units in x per unit of progress.
      const velocityBefore = (offsetX(newer) - offsetX(older)) / 100 / (FRAME_MS / 1000);

      driver.retarget(RETARGET);
      frames.frame(time);
      time += FRAME_MS;
      const snapshotX = offsetX(newer);
      const afterFirst = emitted.at(-1) as Contour[];
      frames.frame(time);
      const afterSecond = emitted.at(-1) as Contour[];
      // Leg 2 moves it from (snapshotX, 0) to (0, 100): 100 units in y per unit of progress.
      expect(offsetX(afterFirst)).toBeLessThan(snapshotX);
      const velocityAfter = (offsetY(afterSecond) - offsetY(afterFirst)) / 100 / (FRAME_MS / 1000);

      expect(velocityBefore).toBeGreaterThan(1);
      expect(velocityAfter).toBeGreaterThan(1);
      expect(Math.abs(velocityAfter - velocityBefore) / velocityBefore).toBeLessThan(0.02);
    });

    it("chains any number of interruptions and settles on the last target", () => {
      const driver = createMorphDriver(FROM, TO, CONFIG);
      const emitted = record(driver);
      let time = 0;
      for (const target of [square(0, 100), square(50, 50), square(-20, 10)]) {
        for (let count = 0; count < 8; count++) {
          frames.frame(time);
          time += 1000 / 60;
        }
        driver.retarget(target);
        expect(frames.pendingCount()).toBe(1);
      }
      runUntilIdle(time, 1000 / 60);
      expect(offsetX(emitted.at(-1) as Contour[])).toBe(-20);
      expect(offsetY(emitted.at(-1) as Contour[])).toBe(10);
      expect(frames.pendingCount()).toBe(0);
    });

    it("never requests more than one frame at a time, however often it's retargeted", () => {
      const driver = createMorphDriver(FROM, TO, CONFIG);
      driver.retarget(square(0, 100));
      driver.retarget(square(10, 100));
      expect(frames.pendingCount()).toBe(1);
    });

    it("restarts from rest on a settled driver", () => {
      const driver = createMorphDriver(FROM, TO, CONFIG);
      const emitted = record(driver);
      const time = runUntilIdle(0, 1000 / 60);
      driver.retarget(RETARGET);
      expect(frames.pendingCount()).toBe(1);
      frames.frame(time);
      // The first frame of a new run steps by 0 from rest: the shape is still the settled one.
      expect(interpolate(TO, RETARGET, 0)).toEqual(emitted.at(-1));
      runUntilIdle(time + 16, 1000 / 60);
      expect(emitted.at(-1)).toBe(RETARGET);
    });

    it("restarts from the frozen shape, at rest, after stop()", () => {
      const driver = createMorphDriver(FROM, TO, CONFIG);
      const emitted = record(driver);
      const time = runTo(0.4, emitted);
      const frozen = emitted.at(-1) as Contour[];
      driver.stop();
      driver.retarget(RETARGET);
      frames.frame(time + 5000);
      expect(emitted.at(-1)).toEqual(interpolate(frozen, RETARGET, 0));
      frames.frame(time + 5016);
      const expected = stepSpring({ position: 0, velocity: 0 }, CONFIG, 1, 0.016);
      expect(emitted.at(-1)).toEqual(interpolate(frozen, RETARGET, expected.position));
    });

    it("throws for an invalid target before changing anything", () => {
      const driver = createMorphDriver(FROM, TO, CONFIG);
      const emitted = record(driver);
      frames.frame(0);
      const orphan: Contour[] = [
        { ...(square(0, 0)[0] as Contour), parentId: "missing", depth: 1 },
      ];
      expect(() => driver.retarget(orphan)).toThrow(TypeError);
      frames.frame(16);
      const expected = stepSpring({ position: 0, velocity: 0 }, CONFIG, 1, 0.016);
      expect(emitted.at(-1)).toEqual(interpolate(FROM, TO, expected.position));
    });
  });

  it("throws RangeError for an invalid config, at creation", () => {
    expect(() => createMorphDriver(FROM, TO, { stiffness: 0, damping: 1, mass: 1 })).toThrow(
      RangeError,
    );
    expect(frames.pendingCount()).toBe(0);
  });

  it("keeps separate drivers independent", () => {
    const soft = record(createMorphDriver(FROM, TO, { stiffness: 50, damping: 14, mass: 1 }));
    const stiff = record(createMorphDriver(FROM, square(0, 100), CONFIG));
    frames.frame(0);
    frames.frame(16);
    const softState = stepSpring(
      { position: 0, velocity: 0 },
      { stiffness: 50, damping: 14, mass: 1 },
      1,
      0.016,
    );
    const stiffState = stepSpring({ position: 0, velocity: 0 }, CONFIG, 1, 0.016);
    expect(soft.at(-1)).toEqual(interpolate(FROM, TO, softState.position));
    expect(stiff.at(-1)).toEqual(interpolate(FROM, square(0, 100), stiffState.position));
  });
});
