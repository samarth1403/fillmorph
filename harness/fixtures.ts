import { readFileSync } from "node:fs";

/**
 * Every committed harness fixture, by file name (without `.svg`) under `harness/fixtures/`. Each is
 * a verbatim copy of the published file `@fortawesome/fontawesome-free@6.7.2/svgs/<style>/<icon>.svg`
 * (Icons: CC BY 4.0; the license comment is kept inside each file), so every spec is graded on
 * real icon markup rather than hand-simplified shapes.
 *
 * The list is explicit, not a directory scan, so adding a fixture is a deliberate, reviewed change.
 */
export const FIXTURE_NAMES = [
  "fa-solid-heart",
  "fa-regular-heart",
  "fa-solid-circle",
  "fa-regular-circle",
  "fa-regular-circle-dot",
  "fa-solid-b",
  "fa-solid-bullseye",
  "fa-solid-user",
  "fa-regular-star",
  "fa-regular-bell",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

/** Reads a committed fixture's SVG markup exactly as stored. */
export function loadFixture(name: FixtureName): string {
  return readFileSync(`${import.meta.dirname}/fixtures/${name}.svg`, "utf8");
}
