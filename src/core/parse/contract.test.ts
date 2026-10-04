import { describe, expect, it } from "vitest";
import {
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
} from "../errors";
import { validateIconContract } from "./contract";
import { parseSvgMarkup } from "./markup";
import {
  CUSTOM_INKSCAPE_RING,
  FA_SOLID_HEART,
  ILLUSTRATOR_STYLESHEET_STROKE,
  LUCIDE_CIRCLE_CHECK,
  LUCIDE_HEART,
  STYLESHEET_STROKE_IN_DEFS,
} from "./test-fixtures";

const validate = (markup: string) =>
  validateIconContract(parseSvgMarkup(markup));
/** Wraps markup in an `<svg>` with a valid viewBox, so the frame check never interferes. */
const svg = (body: string, rootAttributes = ' viewBox="0 0 24 24"'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg"${rootAttributes}>${body}</svg>`;
const SQUARE = 'd="M0 0H10V10H0Z"';

describe("validateIconContract - accepts filled path icons", () => {
  it("accepts a real Font Awesome Solid icon, returning its one path and its viewBox", () => {
    const { paths, viewBox } = validate(FA_SOLID_HEART);
    expect(paths).toHaveLength(1);
    expect(viewBox).toEqual({ x: 0, y: 0, width: 512, height: 512 });
  });

  it("accepts an Inkscape export, ignoring its metadata, editor elements, and empty <defs>", () => {
    const { paths } = validate(CUSTOM_INKSCAPE_RING);
    expect(paths.map((path) => path.element.attributes.get("id"))).toEqual([
      "path1",
    ]);
  });

  it("accepts a <g> without a transform", () => {
    expect(
      validate(svg(`<g fill="black"><path ${SQUARE}/></g>`)).paths,
    ).toHaveLength(1);
  });

  it("ignores paths and gradients inside <defs> that nothing renders", () => {
    const rendered = validate(
      svg(
        `<defs><linearGradient id="g"/><path id="unused" ${SQUARE}/></defs><path id="shown" ${SQUARE}/>`,
      ),
    );
    expect(
      rendered.paths.map((path) => path.element.attributes.get("id")),
    ).toEqual(["shown"]);
  });

  it("accepts a filled path that also has a stroke", () => {
    expect(validate(svg(`<path stroke="red" ${SQUARE}/>`)).paths).toHaveLength(
      1,
    );
  });
});

describe("validateIconContract - rejects stroke icons", () => {
  it("rejects a real Lucide icon, naming its fill and stroke", () => {
    expect(() => validate(LUCIDE_HEART)).toThrow(
      FillmorphIncompatibleIconError,
    );
    expect(() => validate(LUCIDE_HEART)).toThrow(
      /has fill: none, stroke: currentColor \(both inherited from <svg>\) - fillmorph works with filled icons only/,
    );
  });

  it("reports a stroke icon as a stroke icon even when it also contains a <circle>", () => {
    expect(() => validate(LUCIDE_CIRCLE_CHECK)).toThrow(/fill: none/);
  });

  it("rejects when only one of several paths has fill: none", () => {
    expect(() =>
      validate(
        svg(
          `<path ${SQUARE}/><path id="outline" fill="none" stroke="#000" ${SQUARE}/>`,
        ),
      ),
    ).toThrow(/<path> #2 \(id="outline"\) has fill: none, stroke: #000/);
  });

  it("rejects fill: none set through an inline style", () => {
    const markup = svg(
      `<path style="fill:none" ${SQUARE}/>`,
      ' viewBox="0 0 24 24" stroke="#000"',
    );
    expect(() => validate(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => validate(markup)).toThrow(
      /has fill: none, stroke: #000 \(fill set on the path, stroke inherited from <svg>\)/,
    );
  });

  it("rejects fill: none inherited from a <g>", () => {
    expect(() =>
      validate(svg(`<g fill="none" stroke="red"><path ${SQUARE}/></g>`)),
    ).toThrow(/inherited from <g>/);
  });

  // Spec 10 #1: Lucide's `Circle` is a lone `<circle>`, so stage 1 used to report "no <path>".
  const strokeOnlyShapes: [string, string][] = [
    ["<circle>", '<circle cx="12" cy="12" r="10"/>'],
    ["<rect>", '<rect width="18" height="18" x="3" y="3" rx="2"/>'],
    ["<line>", '<line x1="5" y1="12" x2="19" y2="12"/>'],
    ["<polygon>", '<polygon points="12 2 22 22 2 22"/>'],
  ];
  it.each(strokeOnlyShapes)(
    "rejects a stroke-only icon made of a %s and no <path> as a stroke icon",
    (name, body) => {
      const markup = svg(
        body,
        ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"',
      );
      expect(() => validate(markup)).toThrow(FillmorphIncompatibleIconError);
      expect(() => validate(markup)).toThrow(
        new RegExp(
          `A ${name} element has fill: none, stroke: currentColor \\(both inherited from <svg>\\) - fillmorph works with filled icons only`,
        ),
      );
    },
  );

  it("reports a stroke-only <circle> next to filled geometry as an unsupported element", () => {
    expect(() =>
      validate(
        svg(
          `<path ${SQUARE}/><circle r="4" fill="none" stroke="red"/>`,
        ),
      ),
    ).toThrow(/<circle>.*"object to path"/);
  });
});

describe("validateIconContract - elements that draw nothing are skipped (spec 10 #1)", () => {
  const HEART =
    'd="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"';
  const shownIds = (markup: string): (string | undefined)[] =>
    validate(markup).paths.map((path) => path.element.attributes.get("id"));

  it("accepts a Material Design icon, skipping its invisible fill: none bounding-box path", () => {
    expect(
      shownIds(
        svg(`<path id="box" d="M0 0h24v24H0z" fill="none"/><path id="heart" ${HEART}/>`),
      ),
    ).toEqual(["heart"]);
  });

  it("accepts a Material Design icon as react-icons renders it (stroke color inherited at stroke-width 0)", () => {
    const markup = svg(
      `<path id="box" fill="none" d="M0 0h24v24H0z"></path><path id="heart" ${HEART}></path>`,
      ' stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24"',
    );
    expect(shownIds(markup)).toEqual(["heart"]);
  });

  const hidden: [string, string][] = [
    ["a display attribute", `<path id="hidden" display="none" ${SQUARE}/>`],
    ["an inline style", `<path id="hidden" style="display: none" ${SQUARE}/>`],
    ["a hidden <g>", `<g display="none"><path id="hidden" ${SQUARE}/></g>`],
  ];
  it.each(hidden)(
    "excludes a path hidden with display: none through %s",
    (_label, body) => {
      expect(shownIds(svg(`<path id="shown" ${SQUARE}/>${body}`))).toEqual([
        "shown",
      ]);
    },
  );

  it("skips hidden elements before any other check, so a hidden stroke or <circle> isn't rejected", () => {
    expect(
      shownIds(
        svg(
          `<path id="shown" ${SQUARE}/><circle display="none" r="4"/><path display="none" fill="none" stroke="red" ${SQUARE}/>`,
        ),
      ),
    ).toEqual(["shown"]);
  });

  it("still rejects a stroke-only path whose stroke-width is not zero", () => {
    expect(() =>
      validate(
        svg(
          `<path ${SQUARE}/><path fill="none" ${SQUARE}/>`,
          ' viewBox="0 0 24 24" stroke="currentColor" stroke-width="0.5"',
        ),
      ),
    ).toThrow(/<path> #2 has fill: none, stroke: currentColor/);
  });

  it("rejects an icon whose paths all draw nothing as drawing nothing", () => {
    const markup = svg(
      `<path fill="none" ${SQUARE}/><path display="none" ${SQUARE}/>`,
    );
    expect(() => validate(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => validate(markup)).toThrow(/draws nothing fillmorph can morph/);
  });

  it("still reports an icon with no <path> and nothing stroked as having no <path>", () => {
    expect(() => validate(svg('<circle r="4"/>'))).toThrow(FillmorphMarkupError);
    expect(() => validate(svg('<circle r="4"/>'))).toThrow(
      /no <path> element/,
    );
  });
});

describe("validateIconContract - rejects unsupported elements and attributes", () => {
  const unsupported: [string, string, RegExp][] = [
    [
      "a <g> with a transform",
      `<g transform="scale(2)"><path ${SQUARE}/></g>`,
      /transform="scale\(2\)"/,
    ],
    [
      "a <path> with a transform",
      `<path transform="rotate(45)" ${SQUARE}/>`,
      /transform/,
    ],
    [
      "a <use> element",
      `<path id="p" ${SQUARE}/><use href="#p"/>`,
      /shapes reused by reference/,
    ],
    [
      "a <use> hidden inside <defs>",
      `<defs><use href="#p"/></defs><path ${SQUARE}/>`,
      /shapes reused by reference/,
    ],
    [
      "a gradient fill",
      `<defs><linearGradient id="g"/></defs><path fill="url(#g)" ${SQUARE}/>`,
      /gradient and pattern fills/,
    ],
    ["a mask", `<path mask="url(#m)" ${SQUARE}/>`, /mask="url\(#m\)"/],
    [
      "a clip path on a group",
      `<g clip-path="url(#c)"><path ${SQUARE}/></g>`,
      /clip-path/,
    ],
    [
      "a non-path shape",
      `<path ${SQUARE}/><rect width="4" height="4"/>`,
      /<rect>.*"object to path"/,
    ],
    [
      "a <style> element",
      `<style>.a{fill:none}</style><path class="a" ${SQUARE}/>`,
      /<style>/,
    ],
    ["a nested <svg>", `<svg><path ${SQUARE}/></svg>`, /<svg> element/],
    ["text", `<path ${SQUARE}/><text>hi</text>`, /<text>/],
  ];

  it.each(unsupported)(
    "rejects %s with FillmorphIncompatibleIconError",
    (_label, body, message) => {
      expect(() => validate(svg(body))).toThrow(FillmorphIncompatibleIconError);
      expect(() => validate(svg(body))).toThrow(message);
    },
  );

  it("rejects an icon whose only paths are in <defs>", () => {
    expect(() => validate(svg(`<defs><path ${SQUARE}/></defs>`))).toThrow(
      /non-rendering/,
    );
  });
});

/*
 * Coverage matrices for the "one rule, several ways to write it" class of gap. A rule can be
 * sidestepped two ways: by writing the property as an inline `style` declaration instead of an
 * attribute, or by placing the offending element somewhere a rendered-tree walk doesn't look
 * (e.g. inside <defs>). Each matrix enumerates every rule × syntax × placement explicitly, so a
 * missing combination shows up as a failing cell rather than as untested code.
 */

describe("validateIconContract - <style> is rejected wherever it appears", () => {
  const placements: [string, string][] = [
    ["at the top level", `<style>.a{fill:red}</style><path ${SQUARE}/>`],
    [
      "inside <defs>",
      `<defs><style>.a{fill:red}</style></defs><path ${SQUARE}/>`,
    ],
    [
      "nested deeper inside <defs>",
      `<defs><g><style>.a{fill:red}</style></g></defs><path ${SQUARE}/>`,
    ],
    ["inside a <g>", `<g><style>.a{fill:red}</style><path ${SQUARE}/></g>`],
    [
      "inside <metadata>",
      `<metadata><style>.a{fill:red}</style></metadata><path ${SQUARE}/>`,
    ],
    [
      "inside <symbol>",
      `<symbol id="s"><style>.a{fill:red}</style></symbol><path ${SQUARE}/>`,
    ],
    [
      "as a namespace-prefixed <svg:style>",
      `<defs><svg:style>.a{}</svg:style></defs><path ${SQUARE}/>`,
    ],
  ];

  it.each(placements)("rejects a <style> %s", (_label, body) => {
    expect(() => validate(svg(body))).toThrow(FillmorphIncompatibleIconError);
    expect(() => validate(svg(body))).toThrow(/contains a <style> element/);
  });

  it("rejects the minimal stylesheet-styled stroke icon that exposed the <defs> bug", () => {
    expect(() => validate(STYLESHEET_STROKE_IN_DEFS)).toThrow(
      FillmorphIncompatibleIconError,
    );
    expect(() => validate(STYLESHEET_STROKE_IN_DEFS)).toThrow(
      /contains a <style> element/,
    );
  });

  it("rejects an Illustrator-layout export whose stylesheet in <defs> sets fill: none", () => {
    expect(() => validate(ILLUSTRATOR_STYLESHEET_STROKE)).toThrow(
      /contains a <style> element/,
    );
  });

  it("reports a <style> once, not additionally as an unsupported shape", () => {
    expect(() =>
      validate(svg(`<style>.a{}</style><path ${SQUARE}/>`)),
    ).not.toThrow(/Convert the <style>/);
  });
});

describe("validateIconContract - shape-altering properties, as attribute or as inline style", () => {
  const properties: [property: string, value: string][] = [
    ["transform", "scale(2)"],
    ["clip-path", "url(#c)"],
    ["mask", "url(#m)"],
  ];
  const syntaxes: [
    label: string,
    write: (property: string, value: string) => string,
  ][] = [
    ["an attribute", (property, value) => `${property}="${value}"`],
    [
      "an inline style declaration",
      (property, value) => `style="${property}:${value}"`,
    ],
    [
      "a spaced, upper-case, !important style declaration among others",
      (property, value) =>
        `style="opacity: 1; ${property.toUpperCase()} : ${value} !important; color: red"`,
    ],
  ];
  const placements: [label: string, wrap: (written: string) => string][] = [
    [
      "the root <svg>",
      (written) => svg(`<path ${SQUARE}/>`, ` viewBox="0 0 24 24" ${written}`),
    ],
    ["a <g>", (written) => svg(`<g ${written}><path ${SQUARE}/></g>`)],
    ["a <path>", (written) => svg(`<path ${written} ${SQUARE}/>`)],
  ];

  const cells = properties.flatMap(([property, value]) =>
    syntaxes.flatMap(([syntaxLabel, write]) =>
      placements.map(
        ([placementLabel, wrap]) =>
          [
            `${property} as ${syntaxLabel} on ${placementLabel}`,
            property,
            wrap(write(property, value)),
          ] as const,
      ),
    ),
  );

  it.each(cells)("rejects %s", (_label, property, markup) => {
    expect(() => validate(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => validate(markup)).toThrow(
      new RegExp(`has (style=")?${property}`, "i"),
    );
  });

  it.each(properties)(
    "quotes the style form as written when %s comes from style",
    (property, value) => {
      expect(() =>
        validate(svg(`<path style="${property}:${value}" ${SQUARE}/>`)),
      ).toThrow(`style="${property}: ${value}"`);
    },
  );

  it.each(properties)("accepts %s: none in either syntax", (property) => {
    expect(
      validate(svg(`<path ${property}="none" ${SQUARE}/>`)).paths,
    ).toHaveLength(1);
    expect(
      validate(svg(`<path style="${property}: none" ${SQUARE}/>`)).paths,
    ).toHaveLength(1);
  });

  it.each(properties)(
    "lets an inline style declaration override the attribute for %s, both ways",
    (property, value) => {
      // CSS precedence: the style declaration wins over the presentation attribute.
      expect(
        validate(
          svg(
            `<path ${property}="${value}" style="${property}: none" ${SQUARE}/>`,
          ),
        ).paths,
      ).toHaveLength(1);
      expect(() =>
        validate(
          svg(
            `<path ${property}="none" style="${property}: ${value}" ${SQUARE}/>`,
          ),
        ),
      ).toThrow(FillmorphIncompatibleIconError);
    },
  );

  it("accepts inline style declarations that don't alter the shape", () => {
    expect(
      validate(
        svg(
          `<path style="opacity: 0.5; fill: #333; stroke-width: 2" ${SQUARE}/>`,
        ),
      ).paths,
    ).toHaveLength(1);
  });
});

describe("validateIconContract - path geometry set through CSS d", () => {
  it("rejects a <path> whose geometry comes from a style d declaration", () => {
    const markup = svg(`<path style="d: path('M0 0H10V10Z')" ${SQUARE}/>`);
    expect(() => validate(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => validate(markup)).toThrow(
      /sets its geometry through style="d: path/,
    );
  });

  it("accepts a <path> whose geometry is only in the d attribute", () => {
    expect(
      validate(svg(`<path style="opacity: 1" ${SQUARE}/>`)).paths,
    ).toHaveLength(1);
  });
});

describe("validateIconContract - root width/height from inline style (frame fallback)", () => {
  const noViewBox = (rootAttributes: string) =>
    svg(`<path ${SQUARE}/>`, rootAttributes);

  it("uses px width/height from the root's style when there's no viewBox", () => {
    expect(
      validate(noViewBox(' style="width: 32px; height: 16px"')).viewBox,
    ).toEqual({
      x: 0,
      y: 0,
      width: 32,
      height: 16,
    });
  });

  it("lets style width/height override the attributes, as CSS does", () => {
    expect(
      validate(
        noViewBox(' width="10" height="10" style="width: 32px; height: 16px"'),
      ).viewBox,
    ).toEqual({ x: 0, y: 0, width: 32, height: 16 });
  });

  it("ignores a unitless style width (invalid CSS) and falls back to the attribute", () => {
    expect(
      validate(noViewBox(' width="10" height="12" style="width: 32"')).viewBox,
    ).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 12,
    });
  });

  it("rejects a relative style width even when the attribute is numeric", () => {
    const markup = noViewBox(' width="24" height="24" style="width: 100%"');
    expect(() => validate(markup)).toThrow(FillmorphIncompatibleIconError);
    expect(() => validate(markup)).toThrow(/style="width: 100%"/);
  });

  it("ignores style width/height entirely when there's a viewBox", () => {
    expect(
      validate(
        svg(`<path ${SQUARE}/>`, ' viewBox="0 0 24 24" style="width: 50%"'),
      ).viewBox,
    ).toEqual({ x: 0, y: 0, width: 24, height: 24 });
  });
});
