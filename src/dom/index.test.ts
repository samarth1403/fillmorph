import { describe, expect, it } from "vitest";

describe("fillmorph/dom", () => {
  it("loads the dom entry point as a module", async () => {
    const dom = await import("./index");
    expect(dom).toBeTypeOf("object");
  });
});
