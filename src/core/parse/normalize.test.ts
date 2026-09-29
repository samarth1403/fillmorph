import { describe, expect, it } from "vitest";
import type { Point } from "../contour";
import { signedArea } from "./geometry";
import { normalizeContour } from "./normalize";

/** Deterministic PRNG (mulberry32) so property-style runs are reproducible. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random simple (star-shaped) polygon: sorted angles, random radii around a random centre. */
function randomPolygon(random: () => number): Point[] {
  const count = 3 + Math.floor(random() * 30);
  const angles = Array.from({ length: count }, () => random() * 2 * Math.PI).sort((a, b) => a - b);
  const cx = random() * 200 - 100;
  const cy = random() * 200 - 100;
  return angles.map((angle) => {
    const radius = 5 + random() * 50;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

const rotate = (points: readonly Point[], by: number): Point[] => [
  ...points.slice(by),
  ...points.slice(0, by),
];

const SQUARE_CLOCKWISE_ON_SCREEN: Point[] = [
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
  { x: 0, y: 0 },
];

describe("normalizeContour — examples", () => {
  it("runs outer contours counter-clockwise on screen (negative shoelace area)", () => {
    const normalized = normalizeContour(SQUARE_CLOCKWISE_ON_SCREEN, false, 1e-9);
    expect(signedArea(normalized)).toBeLessThan(0);
  });

  it("runs holes clockwise on screen (positive shoelace area)", () => {
    const normalized = normalizeContour([...SQUARE_CLOCKWISE_ON_SCREEN].reverse(), true, 1e-9);
    expect(signedArea(normalized)).toBeGreaterThan(0);
  });

  it("starts at the topmost point, breaking a tie on a flat top edge by leftmost", () => {
    const normalized = normalizeContour(SQUARE_CLOCKWISE_ON_SCREEN, false, 1e-9);
    expect(normalized[0]).toEqual({ x: 0, y: 0 });
    expect(normalized).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ]);
  });

  it("treats y values within the tie tolerance as tied, so float noise can't pick the right end", () => {
    const noisyTop: Point[] = [
      { x: 10, y: 1e-12 },
      { x: 0, y: 2e-12 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];
    expect(normalizeContour(noisyTop, false, 1e-9)[0]).toEqual({ x: 0, y: 2e-12 });
    expect(normalizeContour(noisyTop, false, 0)[0]).toEqual({ x: 10, y: 1e-12 });
  });

  it("does not modify its input", () => {
    const input = SQUARE_CLOCKWISE_ON_SCREEN.map((point) => ({ ...point }));
    normalizeContour(input, false, 1e-9);
    expect(input).toEqual(SQUARE_CLOCKWISE_ON_SCREEN);
  });
});

describe("normalizeContour — properties over random polygons", () => {
  const random = createRandom(0x5eed02);
  const cases = Array.from({ length: 200 }, (_, index) => ({
    index,
    polygon: randomPolygon(random),
    isHole: random() < 0.5,
    rotation: Math.floor(random() * 1000),
  }));

  it("is invariant to the authored start vertex and direction", () => {
    for (const { polygon, isHole, rotation } of cases) {
      const expected = normalizeContour(polygon, isHole, 1e-9);
      const rotated = rotate(polygon, rotation % polygon.length);
      expect(normalizeContour(rotated, isHole, 1e-9)).toEqual(expected);
      expect(normalizeContour([...rotated].reverse(), isHole, 1e-9)).toEqual(expected);
    }
  });

  it("is idempotent", () => {
    for (const { polygon, isHole } of cases) {
      const once = normalizeContour(polygon, isHole, 1e-9);
      expect(normalizeContour(once, isHole, 1e-9)).toEqual(once);
    }
  });

  it("always yields the requested winding and a topmost-then-leftmost first point", () => {
    for (const { polygon, isHole } of cases) {
      const normalized = normalizeContour(polygon, isHole, 0);
      expect(Math.sign(signedArea(normalized))).toBe(isHole ? 1 : -1);
      const first = normalized[0] as Point;
      for (const point of normalized) {
        expect(point.y > first.y || (point.y === first.y && point.x >= first.x)).toBe(true);
      }
    }
  });

  it("keeps exactly the same set of points", () => {
    for (const { polygon, isHole } of cases) {
      const byPosition = (a: Point, b: Point) => a.x - b.x || a.y - b.y;
      expect([...normalizeContour(polygon, isHole, 1e-9)].sort(byPosition)).toEqual(
        [...polygon].sort(byPosition),
      );
    }
  });
});
