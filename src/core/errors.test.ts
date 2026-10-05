import { describe, expect, it } from "vitest";
import {
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
  FillmorphParseError,
  isFillmorphError,
} from "./errors";

describe("isFillmorphError (spec 13 #4)", () => {
  it("recognizes each of fillmorph's error classes", () => {
    expect(isFillmorphError(new FillmorphMarkupError("x"))).toBe(true);
    expect(isFillmorphError(new FillmorphParseError("x"))).toBe(true);
    expect(isFillmorphError(new FillmorphIncompatibleIconError("x"))).toBe(true);
  });

  it("recognizes fillmorph/react's FillmorphIconInputError by name", () => {
    class FillmorphIconInputError extends FillmorphMarkupError {
      override name = "FillmorphIconInputError";
    }
    expect(isFillmorphError(new FillmorphIconInputError("x"))).toBe(true);
  });

  it("recognizes an error from a second copy of fillmorph, which instanceof does not", () => {
    // What the other build (ESM vs. CommonJS) defines: same name, a distinct class.
    class OtherCopyParseError extends Error {
      override name = "FillmorphParseError";
    }
    const error = new OtherCopyParseError("x");
    expect(error instanceof FillmorphParseError).toBe(false);
    expect(isFillmorphError(error)).toBe(true);
  });

  it("rejects other errors and non-errors", () => {
    for (const value of [
      new Error("x"),
      new TypeError("x"),
      { name: "SomethingElse" },
      { name: 42 },
      "FillmorphParseError",
      null,
      undefined,
      0,
    ]) {
      expect(isFillmorphError(value)).toBe(false);
    }
  });
});
