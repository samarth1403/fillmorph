import { describe, expect, it } from "vitest";

describe("fillmorph/dom", () => {
  it("loads the dom entry point as a module", async () => {
    const dom = await import("./index");
    expect(dom).toBeTypeOf("object");
  });

  it("exposes only the morph driver at runtime", async () => {
    const dom = await import("./index");
    expect(Object.keys(dom).sort()).toEqual(["createMorphDriver"]);
  });
});
