import { describe, expect, it } from "vitest";
import { canonicalViewBoxAttribute } from "./display.ts";
import { FIXTURE_NAMES, loadFixture } from "./fixtures.ts";
import { svgDataUri } from "./html.ts";
import { renderRoundTripPage, runRoundTrip } from "./round-trip.ts";

describe("runRoundTrip", () => {
  it.each(FIXTURE_NAMES)("re-parses %s's rendering back to the same contours", (name) => {
    const result = runRoundTrip(name, loadFixture(name));
    expect(result.problems).toEqual([]);
    expect(result.passed).toBe(true);
  });
});

describe("renderRoundTripPage", () => {
  const results = FIXTURE_NAMES.map((name) => runRoundTrip(name, loadFixture(name)));
  const html = renderRoundTripPage(results);

  it("shows each untouched source next to its parsed rendering in the canonical frame", () => {
    for (const result of results) {
      expect(html).toContain(svgDataUri(result.source));
      expect(html).toContain(`<path d="${result.d}" fill="none"`);
    }
    expect(html).toContain(`viewBox="${canonicalViewBoxAttribute()}"`);
  });

  it("renders every comparison viewport as the same square tile", () => {
    expect(html.match(/class="tile"/g)).toHaveLength(results.length * 3);
  });
});
