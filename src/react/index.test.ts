import { describe, expect, it } from "vitest";

describe("fillmorph/react", () => {
  it("loads the react entry point as a module", async () => {
    const react = await import("./index");
    expect(react).toBeTypeOf("object");
  });
});
