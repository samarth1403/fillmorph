import { describe, expect, it } from "vitest";
import type { Point } from "../contour";
import { classifyNesting, type Nesting } from "./classify";

const rectangle = (x: number, y: number, width: number, height: number): Point[] => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

const outer: Nesting = { depth: 0, parentIndex: null };
const child = (depth: number, parentIndex: number): Nesting => ({ depth, parentIndex });

describe("classifyNesting", () => {
  it("gives separate, non-overlapping shapes depth 0 and no parent", () => {
    expect(classifyNesting([rectangle(0, 0, 10, 10), rectangle(20, 0, 10, 10)], 0.01)).toEqual([
      outer,
      outer,
    ]);
  });

  it("links a contour inside another to it, whichever order they appear in", () => {
    expect(classifyNesting([rectangle(0, 0, 10, 10), rectangle(2, 2, 6, 6)], 0.01)).toEqual([
      outer,
      child(1, 0),
    ]);
    expect(classifyNesting([rectangle(2, 2, 6, 6), rectangle(0, 0, 10, 10)], 0.01)).toEqual([
      child(1, 1),
      outer,
    ]);
  });

  it("links an inner shape to the hole it sits in, not to the outermost shape containing both", () => {
    const polygons = [rectangle(4, 4, 2, 2), rectangle(0, 0, 10, 10), rectangle(2, 2, 6, 6)];
    expect(classifyNesting(polygons, 0.01)).toEqual([child(2, 2), outer, child(1, 1)]);
  });

  it("gives sibling holes the same depth and parent instead of nesting them in each other", () => {
    const polygons = [
      rectangle(0, 0, 40, 60),
      rectangle(10, 8, 20, 18),
      rectangle(10, 34, 20, 18),
      rectangle(12, 10, 4, 4),
    ];
    expect(classifyNesting(polygons, 0.01)).toEqual([outer, child(1, 0), child(1, 0), child(2, 1)]);
  });

  it("links each hole to its own outer shape when there are several outer shapes", () => {
    const polygons = [
      rectangle(0, 0, 10, 10),
      rectangle(2, 2, 6, 6),
      rectangle(20, 0, 10, 10),
      rectangle(22, 2, 6, 6),
    ];
    expect(classifyNesting(polygons, 0.01)).toEqual([outer, child(1, 0), outer, child(1, 2)]);
  });

  it("still counts a hole as nested when it touches its outer shape's outline", () => {
    expect(classifyNesting([rectangle(0, 0, 10, 10), rectangle(0, 2, 5, 5)], 0.01)).toEqual([
      outer,
      child(1, 0),
    ]);
  });

  it("treats partially overlapping shapes as not nested", () => {
    expect(classifyNesting([rectangle(0, 0, 10, 10), rectangle(5, 5, 4, 20)], 0.01)).toEqual([
      outer,
      outer,
    ]);
  });

  it("doesn't let two identical contours contain each other", () => {
    expect(classifyNesting([rectangle(0, 0, 10, 10), rectangle(0, 0, 10, 10)], 0.01)).toEqual([
      outer,
      outer,
    ]);
  });

  it("gives every parent a depth exactly one less than its child, over a deep chain", () => {
    const chain = [8, 2, 6, 0, 4].map((inset) =>
      rectangle(inset, inset, 20 - 2 * inset, 20 - 2 * inset),
    );
    const nesting = classifyNesting(chain, 0.01);
    nesting.forEach(({ depth, parentIndex }) => {
      if (parentIndex === null) expect(depth).toBe(0);
      else expect(nesting[parentIndex]?.depth).toBe(depth - 1);
    });
    expect(nesting.map(({ depth }) => depth)).toEqual([4, 1, 3, 0, 2]);
  });
});
