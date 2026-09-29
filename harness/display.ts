import { CANONICAL_VIEW_BOX } from "fillmorph";

/** `CANONICAL_VIEW_BOX` as a `viewBox` attribute value, read from core's constant, never copied. */
export function canonicalViewBoxAttribute(): string {
  const { x, y, width, height } = CANONICAL_VIEW_BOX;
  return `${x} ${y} ${width} ${height}`;
}

/**
 * The harness's display wrapper (spec 03 deliverable #1): places a `renderContours` path in a
 * minimal standalone `<svg>` so it can be viewed. The `viewBox` is always the canonical frame,
 * never an icon's original one, because every parsed and interpolated contour is in that frame.
 * No width/height: the page embedding it sizes the viewport, which must be square.
 */
export function wrapInSvg(d: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${canonicalViewBoxAttribute()}"><path d="${d}" fill="black"/></svg>`;
}
