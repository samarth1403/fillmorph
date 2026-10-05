import { describe, expect, it } from "vitest";

describe("fillmorph (core)", () => {
  it("loads the core entry point as a module", async () => {
    const core = await import("./index");
    expect(core).toBeTypeOf("object");
  });

  it("exposes only the parser, the canonical frame, interpolate, the renderer, the spring step and morph state transitions, the three error types and isFillmorphError at runtime", async () => {
    const core = await import("./index");
    expect(Object.keys(core).sort()).toEqual([
      "CANONICAL_VIEW_BOX",
      "FillmorphIncompatibleIconError",
      "FillmorphMarkupError",
      "FillmorphParseError",
      "advanceMorph",
      "interpolate",
      "isFillmorphError",
      "parseIcon",
      "renderContours",
      "renderLayers",
      "retargetMorph",
      "startMorph",
      "stepSpring",
    ]);
  });
});
