import type { Contour, Point } from "fillmorph";
import type { Frame } from "../frames.ts";
import {
  formatNumber,
  isInsideOrOnPolygon,
  segmentsCross,
} from "../geometry.ts";
import {
  type CheckFailure,
  type CheckResult,
  checkResult,
} from "./check-result.ts";

/**
 * How close (in canonical units, out of 100) a child vertex may be to its parent's outline and
 * still count as touching it rather than being outside.
 */
const TOUCH_TOLERANCE = 1e-7;

function findEscape(child: Contour, parent: Contour): string | null {
  for (const [index, point] of child.points.entries()) {
    if (!isInsideOrOnPolygon(point, parent.points, TOUCH_TOLERANCE)) {
      return `vertex ${index} at (${formatNumber(point.x)}, ${formatNumber(point.y)}) is outside it`;
    }
  }
  const childCount = child.points.length;
  const parentCount = parent.points.length;
  for (let a = 0; a < childCount; a++) {
    const a1 = child.points[a] as Point;
    const a2 = child.points[(a + 1) % childCount] as Point;
    for (let b = 0; b < parentCount; b++) {
      const b1 = parent.points[b] as Point;
      const b2 = parent.points[(b + 1) % parentCount] as Point;
      if (segmentsCross(a1, a2, b1, b2)) {
        return `edge ${a}–${(a + 1) % childCount} crosses its outline (edge ${b}–${(b + 1) % parentCount})`;
      }
    }
  }
  return null;
}

/**
 * Spec 03 deliverable #5, containment: in every frame, every contour with a non-null `parentId`
 * must stay inside the contour **in the same frame** whose `id` equals that `parentId`. That
 * covers holes inside their outer shape and depth-2 shapes inside their hole alike.
 *
 * Contained means every child vertex is inside the parent (or on its outline) **and** no child
 * edge properly crosses a parent edge - vertices alone miss an edge cutting across a concave
 * parent's notch. Touching the outline is allowed; crossing it, or a `parentId` naming no contour
 * in the frame, is a failure.
 */
export function checkContainment(frames: readonly Frame[]): CheckResult {
  const failures: CheckFailure[] = [];
  for (const [frameIndex, frame] of frames.entries()) {
    const byId = new Map(
      frame.contours.map((contour) => [contour.id, contour]),
    );
    for (const child of frame.contours) {
      if (child.parentId === null) continue;
      const parent = byId.get(child.parentId);
      const problem =
        parent === undefined
          ? `its parentId "${child.parentId}" names no contour in this frame`
          : findEscape(child, parent);
      if (problem !== null) {
        failures.push({
          frameIndices: [frameIndex],
          contourId: child.id,
          message: `${frame.label}: ${child.isHole ? "hole" : "shape"} ${child.id} escapes parent ${child.parentId} - ${problem}`,
        });
      }
    }
  }
  return checkResult("containment", failures);
}
