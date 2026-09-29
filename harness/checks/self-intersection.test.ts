import { describe, expect, it } from "vitest";
import { frame, polygon, square } from "../test-shapes.ts";
import { checkSelfIntersection } from "./self-intersection.ts";

const bowtie = polygon("c0", null, 0, [
  [10, 10],
  [90, 90],
  [90, 10],
  [10, 90],
]);

describe("checkSelfIntersection", () => {
  it("flags a deliberately self-intersecting contour, naming the frame, progress and contour", () => {
    const result = checkSelfIntersection([
      frame(0, [square("c0", null, 0, 50, 50, 40)]),
      frame(0.5, [bowtie]),
    ]);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.frameIndices).toEqual([1]);
    expect(result.failures[0]?.contourId).toBe("c0");
    expect(result.failures[0]?.message).toContain("p=0.5");
    expect(result.failures[0]?.message).toContain("(50, 50)");
  });

  it("passes known-clean contours, including a concave one and a hole", () => {
    const concave = polygon("c0", null, 0, [
      [0, 0],
      [0, 30],
      [10, 30],
      [10, 10],
      [20, 10],
      [20, 30],
      [30, 30],
      [30, 0],
    ]);
    const result = checkSelfIntersection([
      frame(0, [square("c0", null, 0, 50, 50, 40), square("c1", "c0", 1, 50, 50, 10)]),
      frame(1, [concave]),
    ]);
    expect(result).toEqual({ check: "self-intersection", passed: true, failures: [], notes: [] });
  });

  it("doesn't count a contour collapsed to a point, or one with repeated points, as crossing", () => {
    const repeated = polygon("c0", null, 0, [
      [0, 0],
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 10],
      [10, 0],
    ]);
    const result = checkSelfIntersection([
      frame(0, [square("c0", null, 0, 50, 50, 0)]),
      frame(1, [repeated]),
    ]);
    expect(result.passed).toBe(true);
  });

  it("reports every self-intersecting frame, not just the first", () => {
    const result = checkSelfIntersection([frame(0.25, [bowtie]), frame(0.75, [bowtie])]);
    expect(result.failures.map((failure) => failure.frameIndices)).toEqual([[0], [1]]);
  });
});
