import { describe, expect, it } from "vitest";

describe("fillmorph (core)", () => {
  it("loads the core entry point as a module", async () => {
    const core = await import("./index");
    expect(core).toBeTypeOf("object");
  });

  it("exposes only the parser, the canonical frame, and the three error types at runtime", async () => {
    const core = await import("./index");
    expect(Object.keys(core).sort()).toEqual([
      "CANONICAL_VIEW_BOX",
      "FillmorphIncompatibleIconError",
      "FillmorphMarkupError",
      "FillmorphParseError",
      "parseIcon",
    ]);
  });
});
