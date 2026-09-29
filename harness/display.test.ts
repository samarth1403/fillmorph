import { CANONICAL_VIEW_BOX, parseIcon, renderContours } from "fillmorph";
import { describe, expect, it } from "vitest";
import { canonicalViewBoxAttribute, wrapInSvg } from "./display.ts";
import { loadFixture } from "./fixtures.ts";
import { polygon } from "./test-shapes.ts";

describe("canonicalViewBoxAttribute", () => {
  it("is built from core's CANONICAL_VIEW_BOX constant", () => {
    const { x, y, width, height } = CANONICAL_VIEW_BOX;
    expect(canonicalViewBoxAttribute()).toBe(`${x} ${y} ${width} ${height}`);
  });
});

describe("wrapInSvg", () => {
  it("wraps a path in a minimal standalone SVG in the canonical frame, filled black", () => {
    expect(wrapInSvg("M0 0L0 10L10 10Z")).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${canonicalViewBoxAttribute()}"><path d="M0 0L0 10L10 10Z" fill="black"/></svg>`,
    );
  });

  it("produces valid SVG that parses back to the contours it was rendered from, hole included", () => {
    const outer = polygon("c0", null, 0, [
      [10, 10],
      [10, 90],
      [90, 90],
      [90, 10],
    ]);
    const hole = polygon("c1", "c0", 1, [
      [30, 30],
      [70, 30],
      [70, 70],
      [30, 70],
    ]);
    expect(parseIcon(wrapInSvg(renderContours([outer, hole]))).contours).toEqual([outer, hole]);
  });

  it("never uses an icon's original viewBox, even for a non-square 320 × 512 source", () => {
    const parsed = parseIcon(loadFixture("fa-solid-b"));
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 320, height: 512 });
    expect(wrapInSvg(renderContours(parsed.contours))).toContain(
      `viewBox="${canonicalViewBoxAttribute()}"`,
    );
  });
});
