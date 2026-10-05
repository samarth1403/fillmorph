import { describe, expect, it } from "vitest";
import type { Contour, Point } from "../contour";
import {
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  FillmorphParseError,
} from "../errors";
import { signedArea } from "./geometry";
import { parseIcon } from "./parse-icon";
import {
  BROKEN_MALFORMED_XML,
  BROKEN_NO_AREA,
  CUSTOM_BULLSEYE,
  CUSTOM_INKSCAPE_RING,
  CUSTOM_TWO_HOLES,
  DEGENERATE_SUBPATH,
  FA_REGULAR_CIRCLE,
  FA_SOLID_BULLSEYE,
  FA_SOLID_CIRCLE,
  FA_SOLID_HEART,
  ILLUSTRATOR_STYLESHEET_STROKE,
  LUCIDE_CIRCLE_CHECK,
  LUCIDE_HEART,
  MD_TWO_TONE,
  OPEN_SUBPATH,
  STYLESHEET_STROKE_IN_DEFS,
} from "./test-fixtures";

/** Wraps path markup in an `<svg>` with a valid viewBox, so frame checks never interfere. */
const svg = (body: string, rootAttributes = ' viewBox="0 0 24 24"'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg"${rootAttributes}>${body}</svg>`;
const contoursOf = (markup: string): Contour[] => parseIcon(markup).contours;
const captureMessage = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected a throw");
};
const area = (contour: Contour | undefined): number =>
  Math.abs(signedArea(contour?.points ?? []));
const outers = (contours: Contour[]) =>
  contours.filter((contour) => !contour.isHole);
const holes = (contours: Contour[]) =>
  contours.filter((contour) => contour.isHole);
const tree = (contours: Contour[]) =>
  contours.map(({ id, parentId, isHole, depth }) => ({
    id,
    parentId,
    isHole,
    depth,
  }));

const ALL_FILLED_FIXTURES = [
  FA_SOLID_HEART,
  FA_SOLID_CIRCLE,
  FA_REGULAR_CIRCLE,
  FA_SOLID_BULLSEYE,
  CUSTOM_INKSCAPE_RING,
  CUSTOM_BULLSEYE,
  CUSTOM_TWO_HOLES,
];

describe("parseIcon - accepts filled icons from different sources", () => {
  it("parses a real Font Awesome Solid icon into one outer contour and its viewBox", () => {
    const { contours, viewBox } = parseIcon(FA_SOLID_HEART);
    expect(tree(contours)).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
    ]);
    expect(viewBox).toEqual({ x: 0, y: 0, width: 512, height: 512 });
  });

  it("parses an Inkscape-style export (style-attribute fill, layer <g>, relative arcs)", () => {
    const { contours, viewBox } = parseIcon(CUSTOM_INKSCAPE_RING);
    expect(tree(contours)).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
    ]);
    expect(viewBox).toEqual({ x: 0, y: 0, width: 64, height: 64 });
  });
});

describe("parseIcon - stage 2 enforces the fill/stroke distinction", () => {
  it("rejects a real Lucide stroke icon with FillmorphIncompatibleIconError", () => {
    expect(() => parseIcon(LUCIDE_HEART)).toThrow(
      FillmorphIncompatibleIconError,
    );
    expect(() => parseIcon(LUCIDE_HEART)).toThrow(
      /fill: none, stroke: currentColor/,
    );
  });

  it("accepts the Font Awesome Solid icon of the same subject (a heart)", () => {
    expect(() => parseIcon(FA_SOLID_HEART)).not.toThrow();
  });

  it("rejects stroke icons whose fill: none lives in a stylesheet inside <defs> (Illustrator)", () => {
    for (const markup of [
      STYLESHEET_STROKE_IN_DEFS,
      ILLUSTRATOR_STYLESHEET_STROKE,
    ]) {
      expect(() => parseIcon(markup)).toThrow(FillmorphIncompatibleIconError);
      expect(() => parseIcon(markup)).toThrow(/contains a <style> element/);
    }
  });

  it("reports a stroke icon as incompatible, not as broken geometry, despite its open subpaths", () => {
    expect(() => parseIcon(LUCIDE_CIRCLE_CHECK)).toThrow(
      FillmorphIncompatibleIconError,
    );
    expect(() => parseIcon(LUCIDE_CIRCLE_CHECK)).toThrow(/fill: none/);
  });

  it("rejects Lucide's Circle (a lone <circle>, no <path>) as a stroke icon, not as missing a <path>", () => {
    const lucideCircle =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';
    expect(() => parseIcon(lucideCircle)).toThrow(
      FillmorphIncompatibleIconError,
    );
    expect(() => parseIcon(lucideCircle)).toThrow(
      /A <circle> element has fill: none, stroke: currentColor/,
    );
  });
});

describe("parseIcon - elements that draw nothing contribute no geometry (spec 10 #1)", () => {
  const MD_FAVORITE_HEART =
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

  it("parses Material Design's MdFavorite, as react-icons renders it, exactly like its heart path alone", () => {
    const asRendered =
      '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">' +
      `<path fill="none" d="M0 0h24v24H0z"></path><path d="${MD_FAVORITE_HEART}"></path></svg>`;
    expect(parseIcon(asRendered)).toEqual(
      parseIcon(svg(`<path d="${MD_FAVORITE_HEART}"/>`)),
    );
  });

  it("leaves out a display: none decorative path, which would otherwise add a contour", () => {
    const decorated = svg(
      `<path d="${MD_FAVORITE_HEART}"/><path display="none" d="M1 1H5V5H1Z"/>`,
    );
    const shown = svg(`<path d="${MD_FAVORITE_HEART}"/>`);
    expect(parseIcon(decorated)).toEqual(parseIcon(shown));
    expect(
      contoursOf(svg(`<path d="${MD_FAVORITE_HEART}"/><path d="M1 1H5V5H1Z"/>`)),
    ).toHaveLength(2);
  });
});

describe("parseIcon - each failure mode has its own error type", () => {
  it("throws FillmorphMarkupError (only) for malformed XML", () => {
    expect(() => parseIcon(BROKEN_MALFORMED_XML)).toThrow(FillmorphMarkupError);
    expect(() => parseIcon(BROKEN_MALFORMED_XML)).toThrow(
      /<path> is closed by <\/svg>/,
    );
  });

  it("throws FillmorphParseError when no subpath in the icon encloses any area", () => {
    expect(() => parseIcon(BROKEN_NO_AREA)).toThrow(FillmorphParseError);
    expect(() => parseIcon(BROKEN_NO_AREA)).toThrow(
      /None of the icon's subpaths encloses any area/,
    );
  });

  describe("an icon whose subpaths all cancel out (spec 13 #1)", () => {
    const SQUARE = "M4 4H20V20H4Z";
    const REVERSED_SQUARE = "M4 4V20H20V4Z";

    it("throws for the same square drawn twice under evenodd, naming the rule and why", () => {
      const markup = svg(`<path fill-rule="evenodd" d="${SQUARE} ${SQUARE}"/>`);
      expect(() => parseIcon(markup)).toThrow(FillmorphParseError);
      expect(() => parseIcon(markup)).toThrow(
        /Every subpath of <path> #1 cancels out under its fill rule, so the icon draws nothing/,
      );
      expect(() => parseIcon(markup)).toThrow(
        /under the "evenodd" fill rule, an area covered an even number of times is left unfilled, so the same outline drawn twice cancels itself/,
      );
      expect(() => parseIcon(markup)).not.toThrow(/nonzero/);
    });

    it("throws for the same square drawn once each way under nonzero, naming that rule", () => {
      const markup = svg(`<path d="${SQUARE} ${REVERSED_SQUARE}"/>`);
      expect(() => parseIcon(markup)).toThrow(FillmorphParseError);
      expect(() => parseIcon(markup)).toThrow(
        /under the "nonzero" fill rule, the same outline drawn once in each direction .* cancels itself/,
      );
      expect(() => parseIcon(markup)).not.toThrow(/evenodd/);
    });

    it("names every path, and each rule once, when several paths all cancel", () => {
      const markup = svg(
        `<path id="a" fill-rule="evenodd" d="${SQUARE} ${SQUARE}"/>` +
          `<path d="${SQUARE} ${REVERSED_SQUARE}"/>` +
          `<path fill-rule="evenodd" d="M6 6H8V8H6Z M6 6H8V8H6Z"/>`,
      );
      expect(() => parseIcon(markup)).toThrow(
        /Every subpath of <path> #1 \(id="a"\), <path> #2, <path> #3 cancels out/,
      );
      const message = captureMessage(() => parseIcon(markup));
      expect(message.match(/"evenodd" fill rule/g)).toHaveLength(1);
      expect(message.match(/"nonzero" fill rule/g)).toHaveLength(1);
    });

    it("doesn't throw when only some paths cancel: the rest still draw", () => {
      const markup = svg(
        `<path fill-rule="evenodd" d="${SQUARE} ${SQUARE}"/><path d="M2 2H6V6H2Z"/>`,
      );
      expect(contoursOf(markup)).toEqual(contoursOf(svg('<path d="M2 2H6V6H2Z"/>')));
    });

    it("doesn't throw for a square drawn twice the same way under nonzero, which is filled", () => {
      expect(contoursOf(svg(`<path d="${SQUARE} ${SQUARE}"/>`))).toEqual(
        contoursOf(svg(`<path d="${SQUARE}"/>`)),
      );
    });

    it("keeps the no-area rejection for an icon with no area at all, checked first", () => {
      expect(() => parseIcon(BROKEN_NO_AREA)).toThrow(/None of the icon's subpaths encloses/);
    });
  });

  it("throws FillmorphParseError for malformed d syntax, with the path and character offset", () => {
    const markup = svg('<path id="bad" d="M0 0 L10 0 L10 10 X Z"/>');
    expect(() => parseIcon(markup)).toThrow(FillmorphParseError);
    expect(() => parseIcon(markup)).toThrow(
      /<path> #1 \(id="bad"\) has malformed path data at character 18: unknown command "X"/,
    );
  });

  it("throws FillmorphParseError for a path with no d attribute", () => {
    expect(() => parseIcon(svg("<path/>"))).toThrow(FillmorphParseError);
    expect(() => parseIcon(svg("<path/>"))).toThrow(
      /<path> #1 has no "d" attribute/,
    );
  });

  it("uses three distinct error classes", () => {
    const errors = [
      BROKEN_MALFORMED_XML,
      BROKEN_NO_AREA,
      LUCIDE_HEART,
    ].map((markup) => {
      try {
        parseIcon(markup);
      } catch (error) {
        return error;
      }
      return undefined;
    });
    expect(errors[0]).toBeInstanceOf(FillmorphMarkupError);
    expect(errors[1]).toBeInstanceOf(FillmorphParseError);
    expect(errors[2]).toBeInstanceOf(FillmorphIncompatibleIconError);
    expect(errors[0]).not.toBeInstanceOf(FillmorphParseError);
    expect(errors[1]).not.toBeInstanceOf(FillmorphIncompatibleIconError);
    expect(errors[2]).not.toBeInstanceOf(FillmorphMarkupError);
    expect((errors as Error[]).map((error) => error.name)).toEqual([
      "FillmorphMarkupError",
      "FillmorphParseError",
      "FillmorphIncompatibleIconError",
    ]);
  });

  it("accepts a subpath without Z whose end point returns to its start (implicit close)", () => {
    expect(contoursOf(svg('<path d="M0 0 L10 0 L10 10 L0 0"/>'))).toHaveLength(
      1,
    );
  });
});

describe("parseIcon - a bad subpath is skipped, not fatal (spec 11 #2)", () => {
  it("fills a subpath without Z as if closed, as browsers do, instead of rejecting the icon", () => {
    const closed = svg(
      '<path fill-rule="evenodd" d="M2 2H22V22H2Z M6 6 L18 6 L18 18Z"/>',
    );
    expect(parseIcon(OPEN_SUBPATH)).toEqual(parseIcon(closed));
    expect(tree(contoursOf(OPEN_SUBPATH))).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
    ]);
  });

  it("fills a lone open subpath with area, rather than dropping it (Material's MdImagesearchRoller-style)", () => {
    expect(parseIcon(svg('<path d="M2 2 L22 2 L22 22"/>'))).toEqual(
      parseIcon(svg('<path d="M2 2 L22 2 L22 22Z"/>')),
    );
  });

  it("skips a zero-area subpath, drawing the rest exactly as without it", () => {
    expect(parseIcon(DEGENERATE_SUBPATH)).toEqual(
      parseIcon(svg('<path d="M2 2H22V22H2Z"/>')),
    );
  });

  it("skips a zero-length 'M x y Z' subpath and an open straight line", () => {
    const square = parseIcon(svg('<path d="M0 0H10V10H0Z"/>'));
    expect(parseIcon(svg('<path d="M0 0H10V10H0Z M5 5Z"/>'))).toEqual(square);
    expect(parseIcon(svg('<path d="M0 0H10V10H0Z M2 2 L8 8"/>'))).toEqual(square);
  });

  it("skips a path whose every subpath is degenerate, keeping the other paths", () => {
    expect(
      parseIcon(svg('<path d="M1 1 L5 5"/><path d="M0 0H10V10H0Z"/>')),
    ).toEqual(parseIcon(svg('<path d="M0 0H10V10H0Z"/>')));
  });
});

describe("parseIcon - hole classification and the containment tree", () => {
  it("flags a ring's inner contour as a hole of its outer contour (Font Awesome)", () => {
    const contours = contoursOf(FA_REGULAR_CIRCLE);
    expect(tree(contours)).toEqual([
      { id: "c0", parentId: "c1", isHole: true, depth: 1 },
      { id: "c1", parentId: null, isHole: false, depth: 0 },
    ]);
    // Canonical frame: the 512-unit viewBox scales by 100/512, so r=256 → 50 and r=208 → 40.625.
    expect(area(outers(contours)[0]) / (Math.PI * 50 ** 2)).toBeCloseTo(1, 2);
    expect(area(holes(contours)[0]) / (Math.PI * 40.625 ** 2)).toBeCloseTo(
      1,
      2,
    );
  });

  it("links a bullseye's dot to the hole it sits in, not to the outermost shape", () => {
    expect(tree(contoursOf(CUSTOM_BULLSEYE))).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
      { id: "c2", parentId: "c1", isHole: false, depth: 2 },
    ]);
  });

  it("gives multiple sibling holes (letter-B shape) the same depth and the same parent", () => {
    expect(tree(contoursOf(CUSTOM_TWO_HOLES))).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
      { id: "c2", parentId: "c0", isHole: true, depth: 1 },
    ]);
  });

  it("links each hole to its own outer shape when an icon has several outer shapes", () => {
    const markup = svg(
      '<path d="M0 0H10V10H0Z M2 2V8H8V2Z"/><path d="M12 0H22V10H12Z M14 2V8H20V2Z"/>',
    );
    expect(tree(contoursOf(markup))).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
      { id: "c2", parentId: null, isHole: false, depth: 0 },
      { id: "c3", parentId: "c2", isHole: true, depth: 1 },
    ]);
  });

  it("chains parents all the way down when nesting is deeper than v1 guarantees (FA bullseye)", () => {
    const contours = contoursOf(FA_SOLID_BULLSEYE);
    const byDepth = [...contours].sort((a, b) => a.depth - b.depth);
    expect(byDepth.map((contour) => contour.depth)).toEqual([0, 1, 2, 3, 4]);
    byDepth.forEach((contour, depth) => {
      expect(contour.parentId).toBe(
        depth === 0 ? null : byDepth[depth - 1]?.id,
      );
    });
  });

  it("classifies holes by containment regardless of how the author wound them", () => {
    const sameDirection = contoursOf(
      svg('<path fill-rule="evenodd" d="M0 0H10V10H0Z M2 2H8V8H2Z"/>'),
    );
    const opposite = contoursOf(svg('<path d="M0 0H10V10H0Z M2 2V8H8V2Z"/>'));
    expect(tree(sameDirection)).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
    ]);
    expect(opposite).toEqual(sameDirection);
  });

  it("fills a same-winding nested contour under nonzero, as browsers do, rather than cutting a hole", () => {
    const contours = contoursOf(
      svg('<path fill-rule="nonzero" d="M0 0H10V10H0Z M2 2H8V8H2Z"/>'),
    );
    expect(contours).toEqual(contoursOf(svg('<path d="M0 0H10V10H0Z"/>')));
  });

  it("keeps the containment tree consistent on every fixture", () => {
    for (const markup of ALL_FILLED_FIXTURES) {
      const contours = contoursOf(markup);
      const byId = new Map(contours.map((contour) => [contour.id, contour]));
      expect(contours.map((contour) => contour.id)).toEqual(
        contours.map((_, index) => `c${index}`),
      );
      for (const contour of contours) {
        if (contour.depth === 0) {
          expect(contour.parentId).toBeNull();
          continue;
        }
        const parent = byId.get(contour.parentId ?? "");
        expect(parent, `parent of ${contour.id}`).toBeDefined();
        expect(parent?.depth).toBe(contour.depth - 1);
        expect(parent?.isHole).toBe(!contour.isHole);
        expect(area(parent)).toBeGreaterThan(area(contour));
      }
    }
  });
});

describe("parseIcon - holes follow fill-rule and winding, as browsers fill (spec 11 #1)", () => {
  const OUTER = "M0 0H20V20H0Z";
  const SAME = "M4 4H16V16H4Z";
  const OPPOSITE = "M4 4V16H16V4Z";
  const SOLID = contoursOf(svg(`<path d="${OUTER}"/>`));

  it("cuts a hole for an oppositely wound nested subpath under nonzero", () => {
    expect(tree(contoursOf(svg(`<path d="${OUTER} ${OPPOSITE}"/>`)))).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
    ]);
  });

  it("treats a missing fill-rule as nonzero, SVG's default", () => {
    expect(contoursOf(svg(`<path d="${OUTER} ${SAME}"/>`))).toEqual(SOLID);
  });

  it("cuts a hole for the same nested subpath under evenodd, whatever its winding", () => {
    for (const inner of [SAME, OPPOSITE]) {
      expect(
        holes(contoursOf(svg(`<path fill-rule="evenodd" d="${OUTER} ${inner}"/>`))),
      ).toHaveLength(1);
    }
  });

  it("keeps evenodd's alternating fill/hole pattern over four nested same-winding subpaths", () => {
    const nested = [0, 3, 6, 8].map(
      (inset) => `M${inset} ${inset}H${20 - inset}V${20 - inset}H${inset}Z`,
    );
    expect(
      tree(contoursOf(svg(`<path fill-rule="evenodd" d="${nested.join(" ")}"/>`))),
    ).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
      { id: "c2", parentId: "c1", isHole: false, depth: 2 },
      { id: "c3", parentId: "c2", isHole: true, depth: 3 },
    ]);
  });

  it("sums winding down the nesting under nonzero: an island in a hole is filled, whichever way it winds", () => {
    for (const island of ["M8 8H12V12H8Z", "M8 8V12H12V8Z"]) {
      expect(tree(contoursOf(svg(`<path d="${OUTER} ${OPPOSITE} ${island}"/>`)))).toEqual([
        { id: "c0", parentId: null, isHole: false, depth: 0 },
        { id: "c1", parentId: "c0", isHole: true, depth: 1 },
        { id: "c2", parentId: "c1", isHole: false, depth: 2 },
      ]);
    }
  });

  it("drops every nested subpath that changes no fill, re-linking what's inside to the nearest kept one", () => {
    // Winding 1, then 2 inside the same-way square, then 1 inside the opposite one: all filled.
    expect(
      contoursOf(svg(`<path d="${OUTER} ${SAME} M8 8V12H12V8Z"/>`)),
    ).toEqual(SOLID);
    // The dropped same-way square doesn't stop the hole beneath it from linking to the outer shape.
    // Winding: 1 (outer), 2 (same-way), 0 (the two opposite ones) - a hole.
    const twoDeep = contoursOf(
      svg(`<path d="${OUTER} M2 2H18V18H2Z M3 3V17H17V3Z ${OPPOSITE}"/>`),
    );
    expect(tree(twoDeep)).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
    ]);
  });

  it("reads fill-rule inherited from a <g> or the <svg> root, and from an inline style", () => {
    const evenodd = contoursOf(svg(`<path fill-rule="evenodd" d="${OUTER} ${SAME}"/>`));
    expect(contoursOf(svg(`<g fill-rule="evenodd"><path d="${OUTER} ${SAME}"/></g>`))).toEqual(
      evenodd,
    );
    expect(
      contoursOf(svg(`<path d="${OUTER} ${SAME}"/>`, ' viewBox="0 0 24 24" fill-rule="evenodd"')),
    ).toEqual(evenodd);
    expect(
      contoursOf(svg(`<path style="fill-rule: evenodd" fill-rule="nonzero" d="${OUTER} ${SAME}"/>`)),
    ).toEqual(evenodd);
    expect(
      contoursOf(svg(`<g fill-rule="evenodd"><path fill-rule="nonzero" d="${OUTER} ${SAME}"/></g>`)),
    ).toEqual(SOLID);
  });

  it("draws a small path stacked on a big one as two solid shapes, with no hole", () => {
    const contours = contoursOf(svg(`<path d="${OUTER}"/><path d="${SAME}"/>`));
    expect(tree(contours)).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: null, isHole: false, depth: 0 },
    ]);
  });

  it("never lets one path's hole cut another path, or a stacked path become a hole, under either rule", () => {
    for (const rule of ["nonzero", "evenodd"]) {
      const ring = `<path fill-rule="${rule}" d="M6 6H14V14H6Z M8 8V12H12V8Z"/>`;
      expect(tree(contoursOf(svg(`<path fill-rule="${rule}" d="${OUTER}"/>${ring}`)))).toEqual([
        { id: "c0", parentId: null, isHole: false, depth: 0 },
        { id: "c1", parentId: null, isHole: false, depth: 0 },
        { id: "c2", parentId: "c1", isHole: true, depth: 1 },
      ]);
    }
  });

  it("links a separate path drawn inside another path's hole to that hole, as an island", () => {
    expect(
      tree(contoursOf(svg(`<path d="${OUTER} ${OPPOSITE}"/><path d="M8 8H12V12H8Z"/>`))),
    ).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
      { id: "c2", parentId: "c1", isHole: false, depth: 2 },
    ]);
  });

  // Spec 10's repro list: a solid shape drawn over a faded copy of the whole icon, as two paths.
  // The hole counts are each path's own, summed ("Holes (each path parsed alone)").
  const TWO_TONE_MD: [string, number][] = [
    ["MdSignalWifi1Bar", 0],
    ["MdSignalWifi1BarLock", 1],
    ["MdSignalWifi2Bar", 0],
    ["MdSignalWifi2BarLock", 1],
    ["MdSignalWifi3Bar", 0],
    ["MdSignalWifi3BarLock", 1],
    ["MdWifiCalling1", 2],
    ["MdWifiCalling2", 2],
  ];
  it.each(TWO_TONE_MD)("draws %s with its own %i holes, the faded layer faded and the top shape opaque", (name, holeCount) => {
    const contours = contoursOf(MD_TWO_TONE[name] as string);
    expect(holes(contours)).toHaveLength(holeCount);
    expect(new Set(contours.map((contour) => contour.opacity ?? 1))).toEqual(new Set([0.3, 1]));
    const filled = outers(contours);
    expect(filled.some((contour) => contour.opacity === 0.3)).toBe(true);
    expect(filled.some((contour) => contour.opacity === undefined)).toBe(true);
  });
});

describe("parseIcon - fill-opacity and opacity (spec 11 #1)", () => {
  const SQUARE = "M0 0H10V10H0Z";
  const opacitiesOf = (markup: string) =>
    contoursOf(markup).map((contour) => contour.opacity);

  it("leaves opaque contours without an opacity field, so opaque icons parse exactly as before", () => {
    expect(contoursOf(FA_SOLID_HEART)[0]).not.toHaveProperty("opacity");
    expect(contoursOf(svg(`<path fill-opacity="1" d="${SQUARE}"/>`))[0]).not.toHaveProperty(
      "opacity",
    );
  });

  it("carries a path's fill-opacity, as a number, a percentage or an inline style", () => {
    expect(opacitiesOf(svg(`<path fill-opacity=".3" d="${SQUARE}"/>`))).toEqual([0.3]);
    expect(opacitiesOf(svg(`<path fill-opacity="40%" d="${SQUARE}"/>`))).toEqual([0.4]);
    expect(opacitiesOf(svg(`<path style="fill-opacity: 0.5" fill-opacity=".3" d="${SQUARE}"/>`))).toEqual([0.5]);
  });

  it("inherits fill-opacity from a <g>, the nearest one winning", () => {
    expect(
      opacitiesOf(svg(`<g fill-opacity=".5"><g fill-opacity=".3"><path d="${SQUARE}"/></g></g>`)),
    ).toEqual([0.3]);
    expect(
      opacitiesOf(svg(`<g fill-opacity=".5"><path fill-opacity=".8" d="${SQUARE}"/></g>`)),
    ).toEqual([0.8]);
  });

  it("multiplies in the opacity of the path and every <g> around it", () => {
    const [opacity] = opacitiesOf(
      svg(`<g opacity=".5"><path opacity=".5" fill-opacity=".8" d="${SQUARE}"/></g>`),
    );
    expect(opacity).toBeCloseTo(0.2, 12);
  });

  it("gives a hole its path's opacity, the same as the shape it cuts", () => {
    expect(
      opacitiesOf(svg(`<path fill-opacity=".3" d="${SQUARE} M2 2V8H8V2Z"/>`)),
    ).toEqual([0.3, 0.3]);
  });

  it("ignores the <svg> root's own opacity and fill-opacity, which style the icon as a whole", () => {
    expect(
      contoursOf(svg(`<path d="${SQUARE}"/>`, ' viewBox="0 0 24 24" opacity=".5" fill-opacity=".5"'))[0],
    ).not.toHaveProperty("opacity");
  });

  it("clamps out-of-range values and ignores unparseable ones, as browsers do", () => {
    expect(opacitiesOf(svg(`<path fill-opacity="2" d="${SQUARE}"/>`))).toEqual([undefined]);
    expect(opacitiesOf(svg(`<path opacity="-1" d="${SQUARE}"/>`))).toEqual([0]);
    expect(
      opacitiesOf(svg(`<g fill-opacity=".3"><path fill-opacity="half" d="${SQUARE}"/></g>`)),
    ).toEqual([0.3]);
  });
});

describe("parseIcon - viewBox", () => {
  it("returns the root's viewBox, including a non-zero origin and comma separators", () => {
    const markup = svg('<path d="M0 0H10V10Z"/>', ' viewBox="-2,-2.5 28 29"');
    expect(parseIcon(markup).viewBox).toEqual({
      x: -2,
      y: -2.5,
      width: 28,
      height: 29,
    });
  });

  it("prefers viewBox over width and height when both are present", () => {
    const markup = svg(
      '<path d="M0 0H10V10Z"/>',
      ' width="48" height="48" viewBox="0 0 24 24"',
    );
    expect(parseIcon(markup).viewBox).toEqual({
      x: 0,
      y: 0,
      width: 24,
      height: 24,
    });
  });

  it("falls back to 0 0 width height from numeric or px width/height when there's no viewBox", () => {
    expect(
      parseIcon(svg('<path d="M0 0H10V10Z"/>', ' width="32" height="16"'))
        .viewBox,
    ).toEqual({
      x: 0,
      y: 0,
      width: 32,
      height: 16,
    });
    expect(
      parseIcon(svg('<path d="M0 0H10V10Z"/>', ' width="24px" height="24.5px"'))
        .viewBox,
    ).toEqual({ x: 0, y: 0, width: 24, height: 24.5 });
  });

  it("rejects an icon with no viewBox and no width/height as incompatible", () => {
    const markup = svg('<path d="M0 0H10V10Z"/>', "");
    expect(() => parseIcon(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => parseIcon(markup)).toThrow(
      /no viewBox and no width or height either/,
    );
  });

  it("rejects an icon with no viewBox and relative width/height as incompatible", () => {
    const markup = svg('<path d="M0 0H10V10Z"/>', ' width="100%" height="1em"');
    expect(() => parseIcon(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => parseIcon(markup)).toThrow(/width="100%" and height="1em"/);
  });

  it("rejects a zero-size viewBox as incompatible (valid SVG that renders nothing)", () => {
    const markup = svg('<path d="M0 0H10V10Z"/>', ' viewBox="0 0 0 24"');
    expect(() => parseIcon(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => parseIcon(markup)).toThrow(/zero width or height/);
  });

  it("rejects a malformed or negative-size viewBox as malformed markup", () => {
    for (const viewBox of [
      "0 0 24",
      "0 0 24 24 24",
      "0 0 a 24",
      "",
      "0 0 -24 24",
    ]) {
      const markup = svg('<path d="M0 0H10V10Z"/>', ` viewBox="${viewBox}"`);
      expect(() => parseIcon(markup), viewBox).toThrow(FillmorphMarkupError);
      expect(() => parseIcon(markup), viewBox).toThrow(/viewBox/);
    }
  });

  it("still reports a stroke icon as a stroke icon even if its frame is also unusable", () => {
    const markup = svg(
      '<path fill="none" stroke="black" d="M0 0H10V10Z"/>',
      "",
    );
    expect(() => parseIcon(markup)).toThrow(/fill: none/);
  });
});

describe("parseIcon - canonical frame", () => {
  const boundsOf = (contours: Contour[]) => {
    const points = contours.flatMap((contour) => contour.points);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  };
  const CIRCLE_16 = svg(
    '<path d="M8 0A8 8 0 1 0 8 16A8 8 0 1 0 8 0Z"/>',
    ' viewBox="0 0 16 16"',
  );

  it("puts a 16-unit and a 512-unit icon of the same shape into the same coordinate range", () => {
    const small = parseIcon(CIRCLE_16);
    const large = parseIcon(FA_SOLID_CIRCLE);
    // Native frames differ 32×; returned viewBoxes stay original…
    expect(small.viewBox).toEqual({ x: 0, y: 0, width: 16, height: 16 });
    expect(large.viewBox).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    // …while contour points land in the same 0–100 range, within flattening tolerance.
    for (const bounds of [boundsOf(small.contours), boundsOf(large.contours)]) {
      expect(bounds.minX).toBeCloseTo(0, 1);
      expect(bounds.minY).toBeCloseTo(0, 1);
      expect(bounds.maxX).toBeCloseTo(100, 1);
      expect(bounds.maxY).toBeCloseTo(100, 1);
    }
    expect(area(small.contours[0]) / area(large.contours[0])).toBeCloseTo(1, 3);
  });

  it("never returns points in the original viewBox's units", () => {
    for (const markup of ALL_FILLED_FIXTURES) {
      const bounds = boundsOf(contoursOf(markup));
      expect(bounds.minX).toBeGreaterThanOrEqual(-1e-9);
      expect(bounds.minY).toBeGreaterThanOrEqual(-1e-9);
      expect(bounds.maxX).toBeLessThanOrEqual(100 + 1e-9);
      expect(bounds.maxY).toBeLessThanOrEqual(100 + 1e-9);
    }
    // 512-unit FA heart: original coordinates run to ~512, canonical ones only to 100.
    expect(boundsOf(contoursOf(FA_SOLID_HEART)).maxX).toBeCloseTo(100, 6);
  });

  it("removes a non-zero viewBox origin", () => {
    const centered = parseIcon(
      svg(
        '<path d="M0 -8A8 8 0 1 0 0 8A8 8 0 1 0 0 -8Z"/>',
        ' viewBox="-8 -8 16 16"',
      ),
    );
    expect(boundsOf(centered.contours)).toEqual(
      boundsOf(contoursOf(CIRCLE_16)),
    );
  });

  it("preserves a non-square viewBox's aspect ratio instead of stretching (letter-B, 40 × 60)", () => {
    const [outer, upperHole, lowerHole] = contoursOf(CUSTOM_TWO_HOLES).map(
      (contour) => boundsOf([contour]),
    );
    if (!outer || !upperHole || !lowerHole)
      throw new Error("expected three contours");
    const scale = 100 / 60;
    // Height (the longest side) spans 0–100; the 40-unit width is centered: margins of 50/3.
    expect(outer.minX).toBeCloseTo(50 / 3, 12);
    expect(outer.maxX).toBeCloseTo(50 / 3 + 40 * scale, 12);
    expect(outer.minY).toBeCloseTo(0, 12);
    expect(outer.maxY).toBeCloseTo(100, 12);
    // Width:height ratios match the source exactly, for the outer shape and for each hole.
    expect((outer.maxX - outer.minX) / (outer.maxY - outer.minY)).toBeCloseTo(
      40 / 60,
      12,
    );
    for (const hole of [upperHole, lowerHole]) {
      expect((hole.maxX - hole.minX) / (hole.maxY - hole.minY)).toBeCloseTo(
        20 / 18,
        12,
      );
    }
  });

  it("keeps a circle circular in a wide viewBox (same scale on both axes)", () => {
    const [circle] = contoursOf(
      svg(
        '<path d="M24 2A10 10 0 1 0 24 22A10 10 0 1 0 24 2Z"/>',
        ' viewBox="0 0 48 24"',
      ),
    );
    const scale = 100 / 48;
    const center = { x: 24 * scale, y: 25 + 12 * scale };
    for (const point of circle?.points ?? []) {
      const radius = Math.hypot(point.x - center.x, point.y - center.y);
      // Flattening sits inside the true circle; cubic arc pieces bulge ≤0.03% outside it.
      expect(radius / (10 * scale)).toBeGreaterThan(0.995);
      expect(radius / (10 * scale)).toBeLessThan(1.0003);
    }
    const bounds = boundsOf(circle ? [circle] : []);
    expect(
      (bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY),
    ).toBeCloseTo(1, 6);
  });

  it("centers the viewBox, not the geometry: an off-center glyph stays off-center", () => {
    const [square] = contoursOf(svg('<path d="M2 2H6V6H2Z"/>'));
    expect(boundsOf(square ? [square] : [])).toEqual({
      minX: (2 * 100) / 24,
      minY: (2 * 100) / 24,
      maxX: (6 * 100) / 24,
      maxY: (6 * 100) / 24,
    });
  });

  it("uses the width/height fallback frame the same way when there's no viewBox", () => {
    const withViewBox = parseIcon(
      svg('<path d="M2 2H6V6H2Z"/>', ' viewBox="0 0 32 16"'),
    );
    const withSize = parseIcon(
      svg('<path d="M2 2H6V6H2Z"/>', ' width="32" height="16"'),
    );
    expect(withSize.contours).toEqual(withViewBox.contours);
    expect(withSize.viewBox).toEqual(withViewBox.viewBox);
    // And that shared frame is really applied (equality alone would also hold with no transform):
    // 32 × 16 → scale 100/32 = 3.125, vertical margin (100 − 50) / 2 = 25.
    const bounds = boundsOf(withSize.contours);
    expect(bounds.minX).toBeCloseTo(2 * 3.125, 12);
    expect(bounds.maxX).toBeCloseTo(6 * 3.125, 12);
    expect(bounds.minY).toBeCloseTo(25 + 2 * 3.125, 12);
    expect(bounds.maxY).toBeCloseTo(25 + 6 * 3.125, 12);
  });

  it("rescales the start-point tie tolerance with the frame, so near-ties resolve the same way", () => {
    // Top edge tilted by 8e-9 original units (5e-8 canonical, since 16 → 100 is ×6.25). That is
    // within the tie tolerance, 1e-9 × icon size, in *either* frame (1.2e-8 original,
    // 7.5e-8 canonical), so the leftmost top point must still win. A tolerance left in original
    // units would treat it as a strict ordering and pick the right-hand end.
    const [square] = contoursOf(
      svg(
        '<path d="M2 2.000000008 L14 2 L14 14 L2 14 Z"/>',
        ' viewBox="0 0 16 16"',
      ),
    );
    expect(square?.points[0]?.x).toBeCloseTo(2 * 6.25, 9);
  });
});

describe("parseIcon - normalization", () => {
  it("winds every outer contour counter-clockwise on screen and every hole clockwise", () => {
    for (const markup of ALL_FILLED_FIXTURES) {
      for (const contour of contoursOf(markup)) {
        expect(Math.sign(signedArea(contour.points))).toBe(
          contour.isHole ? 1 : -1,
        );
      }
    }
  });

  it("starts every contour at its topmost, then leftmost, point", () => {
    for (const markup of ALL_FILLED_FIXTURES) {
      for (const contour of contoursOf(markup)) {
        const [first] = contour.points as [Point];
        const minY = Math.min(...contour.points.map((point) => point.y));
        expect(first.y).toBeCloseTo(minY, 6);
      }
    }
    // Offset from the origin on purpose: (0, 0) maps to (0, 0) in both frames, which would hide
    // a missing canonical transform. Top-left (2, 3) in a 24-unit viewBox is (8.33…, 12.5).
    const [square] = contoursOf(svg('<path d="M12 12 H2 V3 H12 Z"/>'));
    expect(square?.points[0]?.x).toBeCloseTo((2 * 100) / 24, 12);
    expect(square?.points[0]?.y).toBeCloseTo((3 * 100) / 24, 12);
  });

  it("produces identical output for the same shape authored with a different start and direction", () => {
    const authorings = [
      "M0 0H10V10H0Z M2 2H8V8H2Z",
      "M10 10H0V0H10Z M8 8V2H2V8Z",
      "M0 10V0H10V10Z M2 8H8V2H2Z",
      "m10 0v10h-10v-10z m-2 2h-6v6h6z",
    ];
    // evenodd, so the inner square is a hole however each authoring winds it.
    const results = authorings.map((d) =>
      parseIcon(svg(`<path fill-rule="evenodd" d="${d}"/>`)),
    );
    expect(tree(results[0]?.contours ?? [])).toEqual([
      { id: "c0", parentId: null, isHole: false, depth: 0 },
      { id: "c1", parentId: "c0", isHole: true, depth: 1 },
    ]);
    for (const result of results) expect(result).toEqual(results[0]);
  });

  it("is deterministic: parsing the same markup twice gives equal output", () => {
    for (const markup of ALL_FILLED_FIXTURES)
      expect(parseIcon(markup)).toEqual(parseIcon(markup));
  });

  it("does not repeat the first point at the end of a contour", () => {
    for (const contour of contoursOf(FA_REGULAR_CIRCLE)) {
      const first = contour.points[0] as Point;
      const last = contour.points[contour.points.length - 1] as Point;
      expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeGreaterThan(
        1e-6,
      );
    }
  });
});

describe("parseIcon - per-contour adaptive point density", () => {
  it("scales tolerance with the icon, so the same shape gets the same point count at any size", () => {
    const small = contoursOf(
      svg('<path d="M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2Z"/>'),
    );
    const large = contoursOf(
      svg(
        '<path d="M256 0A256 256 0 1 0 256 512A256 256 0 1 0 256 0Z"/>',
        ' viewBox="0 0 512 512"',
      ),
    );
    expect(small[0]?.points.length).toBeGreaterThan(8);
    expect(small[0]?.points.length).toBe(large[0]?.points.length);
  });

  it("gives each contour density for its own shape and size: straight edges stay sparse, a small dot is as smooth as a larger hole", () => {
    const [square, hole, dot] = contoursOf(CUSTOM_BULLSEYE).map(
      (contour) => contour.points.length,
    );
    expect(square).toBe(4);
    // Tolerance is relative to each contour's own size (capped at the icon's), so two circles of
    // different sizes get the same point count - the smaller one is not under-sampled.
    expect(dot).toBe(hole);
  });

  it("keeps the smallest, deepest contour as smooth as the outer ring (FA bullseye regression)", () => {
    // FA's bullseye: five concentric circles, radii 50 → 6.25 canonical, depth 0 → 4. With one
    // icon-wide tolerance the depth-4 disc was a 16-gon (23° per edge, 2% chord gap relative to
    // its radius) against the outer ring's 64 points (5.9°, 0.14%). Each contour must now match
    // the outer ring's angle per edge and relative error.
    const contours = contoursOf(FA_SOLID_BULLSEYE);
    const measure = (contour: Contour) => {
      const radius =
        contour.points.reduce(
          (sum, p) => sum + Math.hypot(p.x - 50, p.y - 50),
          0,
        ) / contour.points.length;
      let maxStep = 0;
      let maxGap = 0;
      contour.points.forEach((p, index) => {
        const q = contour.points[(index + 1) % contour.points.length] as Point;
        const turn = Math.abs(
          Math.atan2(q.y - 50, q.x - 50) - Math.atan2(p.y - 50, p.x - 50),
        );
        maxStep = Math.max(maxStep, Math.min(turn, 2 * Math.PI - turn));
        maxGap = Math.max(
          maxGap,
          radius - Math.hypot((p.x + q.x) / 2 - 50, (p.y + q.y) / 2 - 50),
        );
      });
      return {
        radius,
        maxStep,
        relativeGap: maxGap / radius,
        count: contour.points.length,
      };
    };
    const byDepth = [...contours]
      .sort((a, b) => a.depth - b.depth)
      .map(measure);
    const outer = byDepth[0] as ReturnType<typeof measure>;
    const innermost = byDepth[byDepth.length - 1] as ReturnType<typeof measure>;
    expect(contours.map((c) => c.depth).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(innermost.radius).toBeCloseTo(6.25, 1);
    expect(outer.radius).toBeCloseTo(50, 1);
    for (const ring of byDepth) {
      expect(ring.maxStep).toBeLessThanOrEqual(outer.maxStep * 1.05);
      expect(ring.relativeGap).toBeLessThanOrEqual(outer.relativeGap * 1.05);
      expect(ring.count).toBeGreaterThanOrEqual(outer.count);
    }
    // Absolute error shrinks with the contour, rather than staying at the icon-wide bound.
    expect(innermost.relativeGap * innermost.radius).toBeLessThan(
      outer.relativeGap * outer.radius,
    );
  });

  it("keeps a flattened circle's area within 0.5% of the true area", () => {
    // FA's r=256 circle in a 512-unit viewBox is r=50 in the canonical frame.
    const ratio = area(contoursOf(FA_SOLID_CIRCLE)[0]) / (Math.PI * 50 ** 2);
    expect(ratio).toBeGreaterThan(0.995);
    expect(ratio).toBeLessThanOrEqual(1);
  });
});
