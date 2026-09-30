import type { Contour, Point } from "../contour";

/**
 * Shared helpers for spec 04's morph tests. Not exported from the package.
 */

/** Deterministic PRNG (mulberry32) so property-style runs are reproducible. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random star-shaped (so simple, non-self-intersecting) polygon around `center`, running
 * counter-clockwise on screen like a parsed outer contour.
 */
export function randomPolygon(random: () => number, count: number, center: Point): Point[] {
  const angles = Array.from({ length: count }, () => random() * Math.PI * 2).sort((a, b) => b - a);
  return angles.map((angle) => {
    const radius = 5 + random() * 20;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
}

/** An axis-aligned rectangle as a closed polygon, starting top-left, counter-clockwise on screen. */
export function rectangle(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
    { x: x + width, y },
  ];
}

/** Builds a `Contour` with `isHole` derived from `depth`, the way `parseIcon` does. */
export function contour(
  id: string,
  parentId: string | null,
  depth: number,
  points: Point[],
): Contour {
  return { id, parentId, depth, isHole: depth % 2 === 1, points };
}

/**
 * Verbatim copy of `@fortawesome/fontawesome-free@6.7.2/svgs/regular/heart.svg` (CC BY 4.0,
 * license comment inside), identical to the harness fixture. Paired with spec 02's
 * `FA_SOLID_HEART` for spec 04's rotational-alignment acceptance criterion.
 */
export const FA_REGULAR_HEART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2024 Fonticons, Inc. --><path d="M225.8 468.2l-2.5-2.3L48.1 303.2C17.4 274.7 0 234.7 0 192.8l0-3.3c0-70.4 50-130.8 119.2-144C158.6 37.9 198.9 47 231 69.6c9 6.4 17.4 13.8 25 22.3c4.2-4.8 8.7-9.2 13.5-13.3c3.7-3.2 7.5-6.2 11.5-9c0 0 0 0 0 0C313.1 47 353.4 37.9 392.8 45.4C462 58.6 512 119.1 512 189.5l0 3.3c0 41.9-17.4 81.9-48.1 110.4L288.7 465.9l-2.5 2.3c-8.2 7.6-19 11.9-30.2 11.9s-22-4.2-30.2-11.9zM239.1 145c-.4-.3-.7-.7-1-1.1l-17.8-20-.1-.1s0 0 0 0c-23.1-25.9-58-37.7-92-31.2C81.6 101.5 48 142.1 48 189.5l0 3.3c0 28.5 11.9 55.8 32.8 75.2L256 430.7 431.2 268c20.9-19.4 32.8-46.7 32.8-75.2l0-3.3c0-47.3-33.6-88-80.1-96.9c-34-6.5-69 5.4-92 31.2c0 0 0 0-.1 .1s0 0-.1 .1l-17.8 20c-.3 .4-.7 .7-1 1.1c-4.5 4.5-10.6 7-16.9 7s-12.4-2.5-16.9-7z"/></svg>`;
