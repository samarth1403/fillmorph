import type { Contour } from "fillmorph";
import type { Frame } from "./frames.ts";

/**
 * Hand-built contours and frames for the harness's own tests. Shared by several test files, so it
 * isn't itself a `*.test.ts`.
 */

export function polygon(
  id: string,
  parentId: string | null,
  depth: number,
  points: readonly (readonly [number, number])[],
): Contour {
  return {
    id,
    parentId,
    depth,
    isHole: depth % 2 === 1,
    points: points.map(([x, y]) => ({ x, y })),
  };
}

/** An axis-aligned square centered on (`cx`, `cy`) with half-size `half` (0 gives a point). */
export function square(
  id: string,
  parentId: string | null,
  depth: number,
  cx: number,
  cy: number,
  half: number,
): Contour {
  return polygon(id, parentId, depth, [
    [cx - half, cy - half],
    [cx - half, cy + half],
    [cx + half, cy + half],
    [cx + half, cy - half],
  ]);
}

export function frame(progress: number, contours: Contour[]): Frame {
  return { progress, contours, label: `p=${progress}` };
}
