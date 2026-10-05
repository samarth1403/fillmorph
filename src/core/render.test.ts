import { describe, expect, it } from "vitest";
import type { Contour } from "./contour";
import { CANONICAL_VIEW_BOX } from "./parse/canonical-frame";
import { parseIcon } from "./parse/parse-icon";
import {
  CUSTOM_BULLSEYE,
  CUSTOM_INKSCAPE_RING,
  CUSTOM_TWO_HOLES,
  FA_REGULAR_CIRCLE,
  FA_SOLID_BULLSEYE,
  FA_SOLID_HEART,
} from "./parse/test-fixtures";
import { renderContours, renderLayers } from "./render";

function contour(
  id: string,
  parentId: string | null,
  depth: number,
  points: [number, number][],
): Contour {
  return {
    id,
    parentId,
    depth,
    isHole: depth % 2 === 1,
    points: points.map(([x, y]) => ({ x, y })),
  };
}

/** A standalone SVG in the canonical frame, so re-parsing it applies an identity mapping. */
function canonicalSvg(d: string): string {
  const { x, y, width, height } = CANONICAL_VIEW_BOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}"><path d="${d}"/></svg>`;
}

describe("renderContours", () => {
  it("renders a square with a square hole as two closed subpaths, outer first", () => {
    const outer = contour("c0", null, 0, [
      [10, 10],
      [10, 90],
      [90, 90],
      [90, 10],
    ]);
    const hole = contour("c1", "c0", 1, [
      [30, 30],
      [70, 30],
      [70, 70],
      [30, 70],
    ]);
    expect(renderContours([outer, hole])).toBe(
      "M10 10L10 90L90 90L90 10ZM30 30L70 30L70 70L30 70Z",
    );
  });

  it("renders a parsed two-hole icon (non-square viewBox) exactly in canonical coordinates", () => {
    // 40 × 60 viewBox: scale 100/60, so x gains a 16.667 margin on each side and y spans 0–100.
    // Outer runs counter-clockwise on screen and both holes clockwise, each from its top-left.
    expect(renderContours(parseIcon(CUSTOM_TWO_HOLES).contours)).toBe(
      "M16.667 0L16.667 100L83.333 100L83.333 0Z" +
        "M33.333 13.333L66.667 13.333L66.667 43.333L33.333 43.333Z" +
        "M33.333 56.667L66.667 56.667L66.667 86.667L33.333 86.667Z",
    );
  });

  it("returns an empty string for no contours", () => {
    expect(renderContours([])).toBe("");
  });

  it("skips a contour with no points instead of emitting a bare Z", () => {
    const empty = contour("c0", null, 0, []);
    const triangle = contour("c1", null, 0, [
      [0, 0],
      [0, 10],
      [10, 10],
    ]);
    expect(renderContours([empty, triangle])).toBe("M0 0L0 10L10 10Z");
  });

  it("rounds to 3 decimal places and never prints a negative zero", () => {
    const shape = contour("c0", null, 0, [
      [1.23456, -0.0001],
      [2.0004999, 3.9995],
      [-0.0004, 5],
    ]);
    expect(renderContours([shape])).toBe("M1.235 0L2 4L0 5Z");
  });

  it("emits exactly one M and one Z per non-empty contour, in array order", () => {
    const contours = parseIcon(FA_SOLID_BULLSEYE).contours;
    const d = renderContours(contours);
    expect(d.match(/M/g)).toHaveLength(contours.length);
    expect(d.match(/Z/g)).toHaveLength(contours.length);
    expect(d).toBe(contours.map((each) => renderContours([each])).join(""));
  });

  describe("round-trips through parseIcon in the canonical frame", () => {
    // Half the 3-decimal rounding step, plus floating-point noise.
    const tolerance = 5e-4 + 1e-9;
    const fixtures = {
      FA_SOLID_HEART,
      FA_REGULAR_CIRCLE,
      FA_SOLID_BULLSEYE,
      CUSTOM_BULLSEYE,
      CUSTOM_TWO_HOLES,
      CUSTOM_INKSCAPE_RING,
    };

    for (const [name, svg] of Object.entries(fixtures)) {
      it(`reproduces ${name}'s contours, tree and hole flags to within the rounding step`, () => {
        const original = parseIcon(svg).contours;
        const reparsed = parseIcon(canonicalSvg(renderContours(original))).contours;

        expect(
          reparsed.map(({ id, parentId, isHole, depth }) => ({ id, parentId, isHole, depth })),
        ).toEqual(
          original.map(({ id, parentId, isHole, depth }) => ({ id, parentId, isHole, depth })),
        );
        for (const [index, source] of original.entries()) {
          const copy = reparsed[index] as Contour;
          expect(copy.points).toHaveLength(source.points.length);
          for (const [pointIndex, point] of source.points.entries()) {
            const copied = copy.points[pointIndex];
            expect(Math.abs((copied?.x ?? Number.NaN) - point.x)).toBeLessThanOrEqual(tolerance);
            expect(Math.abs((copied?.y ?? Number.NaN) - point.y)).toBeLessThanOrEqual(tolerance);
          }
        }
      });
    }
  });
});

describe("renderLayers", () => {
  const square = (id: string, x: number, opacity?: number): Contour => ({
    ...contour(id, null, 0, [
      [x, 0],
      [x, 10],
      [x + 10, 10],
      [x + 10, 0],
    ]),
    ...(opacity === undefined ? {} : { opacity }),
  });

  it("gives an all-opaque icon exactly one layer, equal to renderContours", () => {
    for (const markup of [FA_SOLID_HEART, FA_REGULAR_CIRCLE, CUSTOM_BULLSEYE]) {
      const { contours } = parseIcon(markup);
      expect(renderLayers(contours)).toEqual([{ d: renderContours(contours), opacity: 1 }]);
    }
  });

  it("returns no layers for no contours", () => {
    expect(renderLayers([])).toEqual([]);
  });

  it("puts each distinct opacity in its own layer, ordered by first appearance", () => {
    const contours = [square("a", 0, 0.3), square("b", 20), square("c", 40, 0.3)];
    expect(renderLayers(contours)).toEqual([
      { d: renderContours([contours[0] as Contour, contours[2] as Contour]), opacity: 0.3 },
      { d: renderContours([contours[1] as Contour]), opacity: 1 },
    ]);
  });

  it("draws a hole in its parent's layer, so it always cuts the shape it belongs to", () => {
    const outer = square("o", 0, 0.5);
    const hole: Contour = {
      ...contour("h", "o", 1, [
        [2, 2],
        [8, 2],
        [8, 8],
        [2, 8],
      ]),
      opacity: 0.9,
    };
    expect(renderLayers([outer, hole])).toEqual([
      { d: renderContours([outer, hole]), opacity: 0.5 },
    ]);
  });

  it("groups opacities that differ only by float noise", () => {
    expect(renderLayers([square("a", 0, 0.3), square("b", 20, 0.1 + 0.2)])).toHaveLength(1);
  });
});
