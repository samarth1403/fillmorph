import { FillmorphIncompatibleIconError, FillmorphMarkupError, parseIcon } from "fillmorph";
import { describe, expect, it, vi } from "vitest";
import { parseIconMarkup } from "./parse-icon-markup";
import { MALFORMED, SQUARE, STROKE_ONLY } from "./test-helpers";

vi.mock("fillmorph", async (importOriginal) => {
  const core = await importOriginal<typeof import("fillmorph")>();
  return {
    ...core,
    parseIcon: vi.fn((icon: string) => {
      if (icon === "boom") throw new TypeError("not a fillmorph error");
      return core.parseIcon(icon);
    }),
  };
});

describe("parseIconMarkup", () => {
  it("returns a good icon's contours", () => {
    expect(parseIconMarkup(SQUARE)).toEqual({ contours: parseIcon(SQUARE).contours, error: null });
  });

  it("returns core's rejections as values", () => {
    expect(parseIconMarkup(MALFORMED).error).toBeInstanceOf(FillmorphMarkupError);
    expect(parseIconMarkup(STROKE_ONLY).error).toBeInstanceOf(FillmorphIncompatibleIconError);
  });

  it("re-throws anything that isn't a fillmorph rejection", () => {
    expect(() => parseIconMarkup("boom")).toThrow(TypeError);
  });
});
