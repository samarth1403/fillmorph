import type { Contour } from "fillmorph";
import { parseIcon } from "fillmorph";
import { describe, expect, it } from "vitest";
import { loadFixture } from "./fixtures.ts";
import { naiveMorph } from "./morph-fn.ts";
import { polygon, square } from "./test-shapes.ts";

function structure(contours: readonly Contour[]) {
  return contours.map(({ id, parentId, isHole, depth }) => ({ id, parentId, isHole, depth }));
}

describe("naiveMorph (the stub MorphFn)", () => {
  const from = [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 20)];
  // `to` numbers its contours differently from `from`, so borrowed fields would show.
  const to = [
    square("c0", null, 0, 50, 50, 45),
    square("c1", "c0", 1, 30, 50, 10),
    square("c2", "c0", 1, 70, 50, 10),
    square("c3", "c2", 2, 70, 50, 5),
  ];

  it("takes id, parentId, isHole and depth together from `to`, at every progress value", () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      expect(structure(naiveMorph(from, to, progress))).toEqual(structure(to));
    }
  });

  it("returns exactly `to` at progress 1", () => {
    expect(naiveMorph(from, to, 1)).toEqual(to);
  });

  it("keeps a valid tree at every progress value: each parentId names a contour one depth up", () => {
    for (const progress of [0, 0.3, 0.6, 1]) {
      const output = naiveMorph(from, to, progress);
      const byId = new Map(output.map((contour) => [contour.id, contour]));
      for (const contour of output) {
        if (contour.parentId === null) continue;
        expect(byId.get(contour.parentId)?.depth).toBe(contour.depth - 1);
      }
    }
  });

  it("pairs points by index, resampling from[i] with floor(j × nFrom / nTo)", () => {
    const triangle = polygon("c0", null, 0, [
      [0, 0],
      [0, 60],
      [60, 60],
    ]);
    const hexagon = polygon("c0", null, 0, [
      [100, 0],
      [100, 10],
      [100, 20],
      [100, 30],
      [100, 40],
      [100, 50],
    ]);
    // j = 0..5 → from index floor(j × 3 / 6) = 0, 0, 1, 1, 2, 2.
    expect(naiveMorph([triangle], [hexagon], 0)[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 60 },
      { x: 0, y: 60 },
      { x: 60, y: 60 },
      { x: 60, y: 60 },
    ]);
    expect(naiveMorph([triangle], [hexagon], 0.5)[0]?.points[2]).toEqual({ x: 50, y: 40 });
  });

  it("leaves a `to` contour with no `from` partner where it is", () => {
    const extra = to[3] as Contour;
    expect(naiveMorph(from, to, 0.5)[3]?.points).toEqual(extra.points);
  });

  it("drops `from` contours beyond to.length", () => {
    expect(naiveMorph(to, [to[0] as Contour], 0.5)).toHaveLength(1);
  });

  it("works on real parsed icons with different contour and point counts", () => {
    const heart = parseIcon(loadFixture("fa-regular-heart")).contours;
    const circle = parseIcon(loadFixture("fa-regular-circle-dot")).contours;
    const output = naiveMorph(heart, circle, 0.5);
    expect(structure(output)).toEqual(structure(circle));
    expect(output.map((contour) => contour.points.length)).toEqual(
      circle.map((contour) => contour.points.length),
    );
  });
});
