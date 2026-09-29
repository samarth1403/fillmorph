import type { Point } from "../contour";

/** Axis-aligned bounding box. */
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Shoelace signed area of a closed polygon (closing edge implicit). In SVG's y-down coordinates,
 * a positive result means the polygon runs clockwise as displayed on screen.
 */
export function signedArea(points: readonly Point[]): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index] as Point;
    const b = points[(index + 1) % points.length] as Point;
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return twiceArea / 2;
}

export function boundsOf(points: readonly Point[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Whether `point` is strictly inside the closed polygon, by even-odd ray casting. */
export function isPointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let isInside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index] as Point;
    const b = polygon[previous] as Point;
    if (a.y > point.y !== b.y > point.y) {
      const crossingX = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (point.x < crossingX) isInside = !isInside;
    }
  }
  return isInside;
}

/** Shortest distance from `point` to the closed polygon's outline. */
export function distanceToOutline(point: Point, polygon: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index] as Point;
    const b = polygon[(index + 1) % polygon.length] as Point;
    best = Math.min(best, distanceToSegment(point, a, b));
  }
  return best;
}

/** Distance from `point` to the line segment `a`–`b`. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
