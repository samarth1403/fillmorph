import { describe, expect, it } from "vitest";

describe("fillmorph/react", () => {
  it("loads the react entry point as a module", async () => {
    const react = await import("./index");
    expect(react).toBeTypeOf("object");
  });

  it("exposes only <FillMorph> (default and named) and useFillMorph at runtime", async () => {
    const react = await import("./index");
    expect(Object.keys(react).sort()).toEqual(["FillMorph", "default", "useFillMorph"]);
    expect(react.default).toBe(react.FillMorph);
  });
});
