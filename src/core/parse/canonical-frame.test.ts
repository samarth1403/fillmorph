import { describe, expect, it } from "vitest";
import type { Point } from "../contour";
import type { ViewBox } from "../icon";
import { CANONICAL_VIEW_BOX, createCanonicalMapping } from "./canonical-frame";

const corners = (viewBox: ViewBox): Point[] => [
  { x: viewBox.x, y: viewBox.y },
  { x: viewBox.x + viewBox.width, y: viewBox.y + viewBox.height },
];

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

describe("CANONICAL_VIEW_BOX", () => {
  it("is a frozen 0 0 100 100 square", () => {
    expect(CANONICAL_VIEW_BOX).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(Object.isFrozen(CANONICAL_VIEW_BOX)).toBe(true);
  });
});

describe("createCanonicalMapping", () => {
  it("maps a square viewBox exactly onto the canonical frame", () => {
    const { scale, toCanonical } = createCanonicalMapping({ x: 0, y: 0, width: 24, height: 24 });
    expect(scale).toBeCloseTo(100 / 24, 12);
    expect(corners({ x: 0, y: 0, width: 24, height: 24 }).map(toCanonical)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it("removes a non-zero viewBox origin", () => {
    const { toCanonical } = createCanonicalMapping({ x: -8, y: 100, width: 16, height: 16 });
    expect(toCanonical({ x: -8, y: 100 })).toEqual({ x: 0, y: 0 });
    expect(toCanonical({ x: 0, y: 108 })).toEqual({ x: 50, y: 50 });
  });

  it("fits a wide viewBox's width to 100 and centers it vertically", () => {
    const viewBox = { x: 0, y: 0, width: 200, height: 50 };
    expect(corners(viewBox).map(createCanonicalMapping(viewBox).toCanonical)).toEqual([
      { x: 0, y: 37.5 },
      { x: 100, y: 62.5 },
    ]);
  });

  it("fits a tall viewBox's height to 100 and centers it horizontally", () => {
    const viewBox = { x: 0, y: 0, width: 40, height: 80 };
    expect(corners(viewBox).map(createCanonicalMapping(viewBox).toCanonical)).toEqual([
      { x: 25, y: 0 },
      { x: 75, y: 100 },
    ]);
  });

  it("over random viewBoxes: scales uniformly, fits the longest side to 100, and centers", () => {
    const random = createRandom(0xf4a3e);
    for (let run = 0; run < 300; run++) {
      const viewBox = {
        x: random() * 1000 - 500,
        y: random() * 1000 - 500,
        width: 0.5 + random() * 1000,
        height: 0.5 + random() * 1000,
      };
      const { scale, toCanonical } = createCanonicalMapping(viewBox);
      const [topLeft, bottomRight] = corners(viewBox).map(toCanonical) as [Point, Point];
      const mappedWidth = bottomRight.x - topLeft.x;
      const mappedHeight = bottomRight.y - topLeft.y;

      // Longest side spans the frame; aspect ratio unchanged (no stretch).
      expect(Math.max(mappedWidth, mappedHeight)).toBeCloseTo(100, 9);
      expect(mappedWidth / mappedHeight).toBeCloseTo(viewBox.width / viewBox.height, 9);
      // Centered: equal margins on both sides of each axis.
      expect(topLeft.x).toBeCloseTo(100 - bottomRight.x, 9);
      expect(topLeft.y).toBeCloseTo(100 - bottomRight.y, 9);

      // Uniform: any displacement scales by the same factor on both axes.
      const a = {
        x: viewBox.x + random() * viewBox.width,
        y: viewBox.y + random() * viewBox.height,
      };
      const b = {
        x: viewBox.x + random() * viewBox.width,
        y: viewBox.y + random() * viewBox.height,
      };
      const mappedA = toCanonical(a);
      const mappedB = toCanonical(b);
      expect(mappedB.x - mappedA.x).toBeCloseTo((b.x - a.x) * scale, 9);
      expect(mappedB.y - mappedA.y).toBeCloseTo((b.y - a.y) * scale, 9);
    }
  });
});
