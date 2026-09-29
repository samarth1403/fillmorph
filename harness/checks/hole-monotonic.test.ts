import type { Contour } from "fillmorph";
import { describe, expect, it } from "vitest";
import type { Frame } from "../frames.ts";
import { frame, square } from "../test-shapes.ts";
import { checkHoleMonotonic } from "./hole-monotonic.ts";

const outer = square("c0", null, 0, 50, 50, 45);

/** A frame whose hole `c1` is a square of the given area. */
function withHole(progress: number, area: number, extra: Contour[] = []): Frame {
  return frame(progress, [outer, square("c1", "c0", 1, 50, 50, Math.sqrt(area) / 2), ...extra]);
}

describe("checkHoleMonotonic", () => {
  it("passes a hole whose area shrinks monotonically to a point", () => {
    const result = checkHoleMonotonic([
      withHole(0, 400),
      withHole(0.25, 300),
      withHole(0.5, 300),
      withHole(0.75, 100),
      withHole(1, 0),
    ]);
    expect(result.passed).toBe(true);
  });

  it("flags a collapsing hole that shrinks, grows, then shrinks, naming the progress range", () => {
    const result = checkHoleMonotonic([
      withHole(0, 400),
      withHole(0.25, 100),
      withHole(0.5, 250),
      withHole(0.75, 50),
      withHole(1, 0),
    ]);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.contourId).toBe("c1");
    expect(result.failures[0]?.frameIndices).toEqual([1, 2]);
    expect(result.failures[0]?.message).toContain("between p=0.25 and p=0.5");
  });

  it("flags a hole that collapses to a point and then grows back, though its last frame isn't ~0", () => {
    const result = checkHoleMonotonic([
      withHole(0, 400),
      withHole(0.5, 100),
      withHole(1, 0),
      withHole(1.2, 60),
    ]);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.frameIndices).toEqual([2, 3]);
    expect(result.failures[0]?.message).toContain("collapsing to a point but its area grows");
  });

  it("flags a hole growing from a point that shrinks along the way", () => {
    const result = checkHoleMonotonic([withHole(0, 0), withHole(0.5, 300), withHole(1, 200)]);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain("growing from a point");
  });

  it("matches holes by id, so reordering the contour array between frames still passes", () => {
    // c1 collapses 400 → 100 → 0. c2 (area 900) swaps ahead of c1 in the middle frame, so
    // matching the first hole by array position would read 400 → 900 → 0 and fail.
    const other = square("c2", "c0", 1, 25, 25, 15);
    const frames = [
      frame(0, [outer, square("c1", "c0", 1, 70, 70, 10), other]),
      frame(0.5, [other, square("c1", "c0", 1, 70, 70, 5), outer]),
      frame(1, [square("c1", "c0", 1, 70, 70, 0), outer, other]),
    ];
    const result = checkHoleMonotonic(frames);
    expect(result.passed).toBe(true);
    expect(result.notes).toEqual([
      "hole c2 neither collapses to nor grows from a point; its area isn't gated",
    ]);
  });

  it("reports a hole whose id disappears mid-sequence, naming the id and progress", () => {
    const result = checkHoleMonotonic([
      withHole(0, 400),
      withHole(0.25, 300),
      frame(0.5, [outer]),
      withHole(0.75, 100),
      withHole(1, 0),
    ]);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.contourId).toBe("c1");
    expect(result.failures[0]?.frameIndices).toEqual([2]);
    expect(result.failures[0]?.message).toContain("p=0.5: hole c1 is missing");
  });

  it("judges frames in progress order, not the order they were given in", () => {
    const shuffled = [withHole(1, 0), withHole(0, 400), withHole(0.5, 200)];
    expect(checkHoleMonotonic(shuffled).passed).toBe(true);
  });

  it("doesn't gate a hole that neither collapses nor grows from a point, and says so", () => {
    const result = checkHoleMonotonic([withHole(0, 400), withHole(0.5, 100), withHole(1, 400)]);
    expect(result.passed).toBe(true);
    expect(result.notes).toHaveLength(1);
  });
});
