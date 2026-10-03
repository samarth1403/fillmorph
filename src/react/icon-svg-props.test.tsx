import { HeartIcon } from "@heroicons/react/24/solid";
import type { CSSProperties, ReactElement, SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaHeart } from "react-icons/fa6";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeSvgProps, readRootSvgAttributes, toIconSvgProps } from "./icon-svg-props";

const OWNED = ["viewBox", "preserveAspectRatio", "x", "y", "overflow", "id", "xmlns", "version"];

/** An `<svg>` exercising attribute spellings React renders differently from its prop names. */
const KITCHEN_SINK = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    viewBox="0 0 24 24"
    preserveAspectRatio="none"
    id="sink"
    x="1"
    y="2"
    overflow="hidden"
    version="1.1"
    fill="#c00"
    fillOpacity="0.5"
    strokeLinecap="round"
    strokeWidth={1.5}
    tabIndex={-1}
    focusable="false"
    role="img"
    xmlSpace="preserve"
    aria-label={'say "hi" & <bye>'}
    data-icon="sink"
    className="one two"
    style={
      {
        backgroundColor: "red",
        WebkitTransition: "opacity 1s",
        msTransform: "none",
        "--my-var": "url(a;b)",
      } as CSSProperties
    }
  >
    <path d="M4 4H20V20H4Z" />
  </svg>
);

const SAMPLES: [string, ReactElement][] = [
  [
    "react-icons <FaHeart color size className>",
    <FaHeart key="fa" color="red" size={32} className="a" />,
  ],
  [
    "heroicons <HeartIcon className aria-label data-*>",
    <HeartIcon key="hero" className="size-6 text-red-500" aria-label="like" data-x="1" />,
  ],
  ["a hand-written <svg> with unusual attributes", KITCHEN_SINK],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readRootSvgAttributes", () => {
  it("reads the root <svg>'s attributes in order, decoding entities", () => {
    expect(
      readRootSvgAttributes(
        '<svg a="1" b-c="x &amp; &quot;y&quot; &#x27;z&#x27; &lt;&gt; &#38;" d=""><path e="no"/></svg>',
      ),
    ).toEqual([
      ["a", "1"],
      ["b-c", "x & \"y\" 'z' <> &"],
      ["d", ""],
    ]);
  });

  it("returns null when the root isn't an <svg>", () => {
    expect(readRootSvgAttributes("<div></div>")).toBeNull();
    expect(readRootSvgAttributes("")).toBeNull();
  });
});

describe("toIconSvgProps", () => {
  it("keeps the frame attributes fillmorph owns, and xmlns:*, for itself", () => {
    const props = toIconSvgProps(renderToStaticMarkup(KITCHEN_SINK)) ?? {};
    for (const owned of [...OWNED, "xmlnsXlink"]) expect(props).not.toHaveProperty(owned);
  });

  it("turns attribute names into React prop names and style into an object", () => {
    expect(toIconSvgProps(renderToStaticMarkup(KITCHEN_SINK))).toEqual({
      fill: "#c00",
      fillOpacity: "0.5",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      tabIndex: "-1",
      focusable: "false",
      role: "img",
      xmlSpace: "preserve",
      "aria-label": 'say "hi" & <bye>',
      "data-icon": "sink",
      className: "one two",
      style: {
        backgroundColor: "red",
        WebkitTransition: "opacity 1s",
        msTransform: "none",
        "--my-var": "url(a;b)",
      },
    });
  });

  it.each(SAMPLES)("round-trips through React with no warnings: %s", (_name, element) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = readRootSvgAttributes(renderToStaticMarkup(element)) ?? [];
    const props = toIconSvgProps(renderToStaticMarkup(element)) as SVGProps<SVGSVGElement>;
    const again = readRootSvgAttributes(renderToStaticMarkup(<svg {...props} />)) ?? [];
    const unowned = original.filter(
      ([name]) => !OWNED.includes(name) && !name.startsWith("xmlns:"),
    );
    expect(new Map(again)).toEqual(new Map(unowned));
    expect(error).not.toHaveBeenCalled();
  });

  it("returns null when the markup's root isn't an <svg>", () => {
    expect(toIconSvgProps("<div></div>")).toBeNull();
  });
});

describe("mergeSvgProps", () => {
  const icon = {
    fill: "red",
    width: "1em",
    className: "icon",
    style: { color: "red", opacity: "1" },
  };

  it("lets every prop passed directly win, except className and style, which combine", () => {
    expect(
      mergeSvgProps(icon, { fill: "blue", className: "mine", style: { opacity: 0.5 } }),
    ).toEqual({
      fill: "blue",
      width: "1em",
      className: "icon mine",
      style: { color: "red", opacity: 0.5 },
    });
  });

  it("treats a prop passed as undefined as not passed", () => {
    expect(mergeSvgProps(icon, { fill: undefined, className: undefined })).toEqual(icon);
  });

  it("passes the caller's props through untouched when there's no icon element", () => {
    const explicit = { fill: "blue" };
    expect(mergeSvgProps(null, explicit)).toBe(explicit);
  });
});
