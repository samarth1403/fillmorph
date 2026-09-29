import { describe, expect, it } from "vitest";
import { FillmorphMarkupError } from "../errors";
import { parseSvgMarkup } from "./markup";
import {
  CUSTOM_INKSCAPE_RING,
  FA_SOLID_HEART,
  LUCIDE_CIRCLE_CHECK,
  LUCIDE_HEART,
} from "./test-fixtures";

const svg = (body: string, rootAttributes = ""): string =>
  `<svg xmlns="http://www.w3.org/2000/svg"${rootAttributes}>${body}</svg>`;

describe("parseSvgMarkup — source-agnostic extraction", () => {
  it("extracts the path from Font Awesome's single-line markup with a license comment", () => {
    const { root, paths } = parseSvgMarkup(FA_SOLID_HEART);
    expect(root.name).toBe("svg");
    expect(root.attributes.get("viewBox")).toBe("0 0 512 512");
    expect(paths).toHaveLength(1);
    expect(paths[0]?.d).toMatch(/^M47\.6 300\.4L/);
  });

  it("extracts the path from Lucide's multi-line markup with a comment before the root", () => {
    const { paths } = parseSvgMarkup(LUCIDE_HEART);
    expect(paths).toHaveLength(1);
    expect(paths[0]?.d).toMatch(/^M19 14c/);
  });

  it("extracts the path from an Inkscape export with an XML declaration and editor metadata", () => {
    const { root, paths } = parseSvgMarkup(CUSTOM_INKSCAPE_RING);
    expect(root.attributes.get("id")).toBe("svg5");
    expect(paths).toHaveLength(1);
    expect(paths[0]?.element.attributes.get("id")).toBe("path1");
    expect(paths[0]?.d).toMatch(/^m 32,4 a 28,28/);
  });

  it("extracts every <path> in document order, including nested and non-rendered ones", () => {
    const { paths } = parseSvgMarkup(
      svg('<defs><path id="a" d="M0 0"/></defs><g><path id="b" d="M1 1"/></g><path id="c"/>'),
    );
    expect(paths.map((path) => path.element.attributes.get("id"))).toEqual(["a", "b", "c"]);
    expect(paths.map((path) => path.index)).toEqual([0, 1, 2]);
    expect(paths[2]?.d).toBeUndefined();
  });

  it("decodes predefined entities and character references in attribute values", () => {
    const { paths } = parseSvgMarkup(svg('<path id="a&amp;b&#x41;&#66;&lt;" d="M0 0"/>'));
    expect(paths[0]?.element.attributes.get("id")).toBe("a&bAB<");
  });

  it("accepts a DOCTYPE with an internal subset, CDATA, and single-quoted attributes", () => {
    const markup = `<?xml version="1.0"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [
  <!ENTITY ns_svg "http://www.w3.org/2000/svg">
]>
<svg xmlns="&ns_svg;"><desc><![CDATA[a <b> & c]]></desc><path d='M0 0H1V1Z'/></svg>`;
    const { root, paths } = parseSvgMarkup(markup);
    expect(root.attributes.get("xmlns")).toBe("&ns_svg;");
    expect(paths[0]?.d).toBe("M0 0H1V1Z");
  });

  it("strips a leading byte-order mark", () => {
    expect(parseSvgMarkup(`﻿${svg('<path d="M0 0"/>')}`).paths).toHaveLength(1);
  });
});

describe("parseSvgMarkup — does not judge content (that is stage 2's job)", () => {
  it("succeeds on a stroke icon", () => {
    expect(parseSvgMarkup(LUCIDE_HEART).paths[0]?.fill.value).toBe("none");
  });

  it("succeeds on markup containing non-path shapes", () => {
    expect(parseSvgMarkup(LUCIDE_CIRCLE_CHECK).paths).toHaveLength(1);
  });

  it("succeeds on a path with malformed d data or no d at all", () => {
    expect(parseSvgMarkup(svg('<path d="Q nonsense"/><path/>')).paths).toHaveLength(2);
  });

  it("succeeds with transforms, <use>, and gradients present", () => {
    const markup = svg(
      '<defs><linearGradient id="g"/></defs><g transform="scale(2)"><path d="M0 0" fill="url(#g)"/></g><use href="#x"/>',
    );
    expect(parseSvgMarkup(markup).paths).toHaveLength(1);
  });
});

describe("parseSvgMarkup — effective fill and stroke", () => {
  const onlyPath = (markup: string) => {
    const path = parseSvgMarkup(markup).paths[0];
    if (!path) throw new Error("fixture has no path");
    return path;
  };

  it("falls back to SVG's defaults: fill black, stroke none", () => {
    const path = onlyPath(svg('<path d="M0 0"/>'));
    expect(path.fill).toEqual({ value: "black", source: undefined });
    expect(path.stroke).toEqual({ value: "none", source: undefined });
  });

  it("inherits from the <svg> root when the path sets nothing", () => {
    const path = onlyPath(LUCIDE_HEART);
    expect(path.fill.value).toBe("none");
    expect(path.fill.source?.name).toBe("svg");
    expect(path.stroke.value).toBe("currentColor");
  });

  it("lets the path's own attribute win over the root's", () => {
    const path = onlyPath(svg('<path fill="red" d="M0 0"/>', ' fill="none"'));
    expect(path.fill.value).toBe("red");
    expect(path.fill.source?.name).toBe("path");
  });

  it("inherits from an intermediate <g> before the root", () => {
    const path = onlyPath(svg('<g fill="none"><path d="M0 0"/></g>', ' fill="red"'));
    expect(path.fill.value).toBe("none");
    expect(path.fill.source?.name).toBe("g");
  });

  it("lets an inline style declaration beat the same element's presentation attribute", () => {
    const path = onlyPath(svg('<path fill="red" style="stroke:blue; fill: none" d="M0 0"/>'));
    expect(path.fill.value).toBe("none");
    expect(path.stroke.value).toBe("blue");
  });

  it("treats 'inherit' as deferring to the parent", () => {
    const path = onlyPath(svg('<path fill="inherit" d="M0 0"/>', ' fill="none"'));
    expect(path.fill.value).toBe("none");
  });
});

describe("parseSvgMarkup — rejects markup that isn't well-formed SVG", () => {
  const malformed: [string, string][] = [
    ["an empty string", ""],
    ["whitespace only", "   \n"],
    ["plain text", "M0 0 L10 10 Z"],
    ["an unclosed element", '<svg><path d="M0 0H1V1Z"></svg>'],
    ["a mismatched closing tag", "<svg><g></svg></g>"],
    ["a stray closing tag", "<svg></svg></g>"],
    ["an element never closed at end of input", "<svg><g>"],
    ["an unquoted attribute", "<svg><path d=M0/></svg>"],
    ["an attribute without a value", "<svg><path d/></svg>"],
    ["a duplicated attribute", '<svg><path d="M0" d="M1"/></svg>'],
    ["attributes not separated by whitespace", '<svg><path id="a"d="M0"/></svg>'],
    ["an unterminated attribute value", '<svg><path d="M0/></svg>'],
    ["'<' inside an attribute value", '<svg><path d="M0 <1"/></svg>'],
    ["a bare '&'", '<svg><path id="a & b" d="M0"/></svg>'],
    ["an invalid character reference", '<svg><path id="&#xZZ;" d="M0"/></svg>'],
    ["an unterminated comment", "<svg><!-- oops <path/></svg>"],
    ["text after the root", "<svg><path/></svg> trailing"],
    ["two root elements", "<svg><path/></svg><svg/>"],
    ["an unfinished tag", "<svg"],
  ];

  it.each(malformed)("throws FillmorphMarkupError for %s", (_label, markup) => {
    expect(() => parseSvgMarkup(markup)).toThrow(FillmorphMarkupError);
  });

  it("throws FillmorphMarkupError when the root element isn't <svg>", () => {
    expect(() => parseSvgMarkup('<html><path d="M0 0"/></html>')).toThrow(/root element is <html>/);
  });

  it("throws FillmorphMarkupError when there is no <path> at all", () => {
    expect(() => parseSvgMarkup(svg('<circle r="4"/>'))).toThrow(FillmorphMarkupError);
    expect(() => parseSvgMarkup(svg('<circle r="4"/>'))).toThrow(/no <path> element/);
  });

  it("throws FillmorphMarkupError for non-string input from untyped callers", () => {
    expect(() => parseSvgMarkup(undefined as unknown as string)).toThrow(FillmorphMarkupError);
  });

  it("reports the line of the problem", () => {
    expect(() => parseSvgMarkup("<svg>\n<g>\n</svg>")).toThrow(/line 3/);
  });
});

describe("parseSvgMarkup — viewBox syntax", () => {
  it("parses whitespace- and comma-separated viewBox values, including negative origins", () => {
    expect(parseSvgMarkup(FA_SOLID_HEART).viewBox).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(
      parseSvgMarkup(svg('<path d="M0 0"/>', ' viewBox=" -1.5, -2 1e1\n24 "')).viewBox,
    ).toEqual({ x: -1.5, y: -2, width: 10, height: 24 });
  });

  it("leaves the viewBox undefined when absent — deciding what that means is stage 2's job", () => {
    expect(parseSvgMarkup(svg('<path d="M0 0"/>')).viewBox).toBeUndefined();
  });

  it("accepts a zero-size viewBox, which is syntactically valid SVG", () => {
    expect(parseSvgMarkup(svg('<path d="M0 0"/>', ' viewBox="0 0 0 0"')).viewBox).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it.each([
    ["too few numbers", "0 0 24"],
    ["too many numbers", "0 0 24 24 1"],
    ["a non-number", "0 0 24px 24"],
    ["an empty value", ""],
    ["a doubled comma", "0,,0 24 24"],
    ["a negative width", "0 0 -24 24"],
    ["a negative height", "0 0 24 -1"],
  ])("throws FillmorphMarkupError for a viewBox with %s", (_label, viewBox) => {
    const markup = svg('<path d="M0 0"/>', ` viewBox="${viewBox}"`);
    expect(() => parseSvgMarkup(markup)).toThrow(FillmorphMarkupError);
    expect(() => parseSvgMarkup(markup)).toThrow(/viewBox/);
  });
});
