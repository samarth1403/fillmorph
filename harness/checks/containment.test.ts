import { describe, expect, it } from "vitest";
import { frame, polygon, square } from "../test-shapes.ts";
import { checkContainment } from "./containment.ts";

const outer = square("c0", null, 0, 50, 50, 40);

/** A U shape: two arms (x 10–20 and 40–50) joined along the bottom (y 40–50), open at the top. */
const concaveParent = polygon("c0", null, 0, [
  [10, 0],
  [10, 50],
  [50, 50],
  [50, 0],
  [40, 0],
  [40, 40],
  [20, 40],
  [20, 0],
]);

describe("checkContainment", () => {
  it("flags a hole with a vertex outside its parent", () => {
    const hole = polygon("c1", "c0", 1, [
      [40, 40],
      [95, 50],
      [40, 60],
    ]);
    const result = checkContainment([frame(0.5, [outer, hole])]);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.contourId).toBe("c1");
    expect(result.failures[0]?.frameIndices).toEqual([0]);
    expect(result.failures[0]?.message).toContain("p=0.5: hole c1 escapes parent c0");
    expect(result.failures[0]?.message).toContain("vertex 1");
  });

  it("flags a hole whose vertices are all inside a concave parent but whose edge crosses its outline", () => {
    // Left vertices sit in the left arm, right ones in the right arm; the edges between them
    // cut across the notch between the arms, which is outside the parent.
    const hole = polygon("c1", "c0", 1, [
      [12, 20],
      [12, 25],
      [48, 25],
      [48, 20],
    ]);
    const result = checkContainment([frame(0, [concaveParent, hole])]);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain("crosses its outline");
  });

  it("flags a depth-2 inner shape that escapes its parent hole", () => {
    const hole = square("c1", "c0", 1, 50, 50, 20);
    const dot = square("c2", "c1", 2, 68, 50, 5);
    const result = checkContainment([frame(0.75, [outer, hole, dot])]);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.contourId).toBe("c2");
    expect(result.failures[0]?.message).toContain("shape c2 escapes parent c1");
  });

  it("flags a contour whose parentId names no contour in its frame", () => {
    const orphan = square("c1", "c9", 1, 50, 50, 10);
    const result = checkContainment([frame(1, [outer, orphan])]);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.message).toContain(`parentId "c9" names no contour in this frame`);
  });

  it("looks the parent up in the same frame, not an earlier one", () => {
    const hole = square("c1", "c0", 1, 50, 50, 10);
    const result = checkContainment([frame(0, [outer, hole]), frame(1, [hole])]);
    expect(result.failures.map((failure) => failure.frameIndices)).toEqual([[1]]);
  });

  it("passes a known-contained hole and a known-contained depth-2 inner shape", () => {
    const hole = square("c1", "c0", 1, 50, 50, 20);
    const dot = square("c2", "c1", 2, 50, 50, 5);
    expect(checkContainment([frame(0, [outer, hole, dot])]).passed).toBe(true);
  });

  it("passes a hole and a depth-2 shape that touch their parent's outline without crossing it", () => {
    // Hole: a triangle with one vertex on the outer square's left edge and one edge along its top.
    const hole = polygon("c1", "c0", 1, [
      [10, 10],
      [50, 10],
      [10, 50],
    ]);
    // Depth-2 shape: a triangle sharing the hole's corner and running along two of its edges.
    const inner = polygon("c2", "c1", 2, [
      [10, 10],
      [30, 10],
      [10, 30],
    ]);
    expect(checkContainment([frame(0, [outer, hole, inner])]).passed).toBe(true);
  });

  it("passes a hole in a concave parent that stays within one arm", () => {
    const hole = polygon("c1", "c0", 1, [
      [12, 5],
      [12, 45],
      [18, 45],
      [18, 5],
    ]);
    expect(checkContainment([frame(0, [concaveParent, hole])]).passed).toBe(true);
  });
});
