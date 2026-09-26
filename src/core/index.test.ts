import { describe, expect, it } from "vitest";

describe("fillmorph (core)", () => {
  it("loads the core entry point as a module", async () => {
    const core = await import("./index");
    expect(core).toBeTypeOf("object");
  });
});
