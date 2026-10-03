import type { Contour, Point } from "fillmorph";
import type { Frame } from "../frames.ts";
import { crossingPoint, formatNumber, segmentsCross } from "../geometry.ts";
import {
  type CheckFailure,
  type CheckResult,
  checkResult,
} from "./check-result.ts";

type Crossing = { edgeA: number; edgeB: number; at: Point };

function findCrossings(points: readonly Point[]): Crossing[] {
  const count = points.length;
  const crossings: Crossing[] = [];
  for (let a = 0; a < count; a++) {
    const a1 = points[a] as Point;
    const a2 = points[(a + 1) % count] as Point;
    // Skip the two edges sharing a vertex with edge `a` (b = a + 1, and b = count - 1 when a = 0).
    for (let b = a + 2; b < count; b++) {
      if (a === 0 && b === count - 1) continue;
      const b1 = points[b] as Point;
      const b2 = points[(b + 1) % count] as Point;
      if (
        Math.max(a1.x, a2.x) < Math.min(b1.x, b2.x) ||
        Math.max(b1.x, b2.x) < Math.min(a1.x, a2.x) ||
        Math.max(a1.y, a2.y) < Math.min(b1.y, b2.y) ||
        Math.max(b1.y, b2.y) < Math.min(a1.y, a2.y)
      ) {
        continue;
      }
      if (segmentsCross(a1, a2, b1, b2)) {
        crossings.push({
          edgeA: a,
          edgeB: b,
          at: crossingPoint(a1, a2, b1, b2),
        });
      }
    }
  }
  return crossings;
}

function describe(
  contour: Contour,
  frame: Frame,
  crossings: Crossing[],
): string {
  const [first] = crossings as [Crossing];
  const count = contour.points.length;
  return (
    `${frame.label}: contour ${contour.id} self-intersects - edges ${first.edgeA}–${(first.edgeA + 1) % count}` +
    ` and ${first.edgeB}–${(first.edgeB + 1) % count} cross at (${formatNumber(first.at.x)}, ${formatNumber(first.at.y)})` +
    (crossings.length > 1
      ? ` (${crossings.length} crossings in this contour)`
      : "")
  );
}

/**
 * Spec 03 deliverable #5, self-intersection: in every frame, no contour's edges may properly
 * cross each other. Touching and collinear overlap aren't crossings, so a contour collapsed to a
 * point (every vertex equal) passes. Reports one failure per self-intersecting contour per frame.
 */
export function checkSelfIntersection(frames: readonly Frame[]): CheckResult {
  const failures: CheckFailure[] = [];
  for (const [frameIndex, frame] of frames.entries()) {
    for (const contour of frame.contours) {
      const crossings = findCrossings(contour.points);
      if (crossings.length > 0) {
        failures.push({
          frameIndices: [frameIndex],
          contourId: contour.id,
          message: describe(contour, frame, crossings),
        });
      }
    }
  }
  return checkResult("self-intersection", failures);
}
