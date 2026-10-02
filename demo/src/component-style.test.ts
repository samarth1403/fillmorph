import { describe, expect, it } from "vitest";

/** The demo's and the dev check page's component sources, as text (tests excluded). */
const SOURCES = {
  ...import.meta.glob<string>(["./**/*.tsx", "!./**/*.test.tsx"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob<string>("../../dev/react-check/*.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};

/**
 * `code-standards.md`: React components are arrow function components (a maintainer decision,
 * spec 08 §1h #2), so a `function`-declaration or class component here fails. Hooks and helpers,
 * which aren't components (lower-case names), are unaffected. `src/react` is outside this scan.
 */
describe("React component style in the demo and the dev check page", () => {
  it.each(Object.entries(SOURCES))("%s defines components as arrow functions", (_path, source) => {
    expect(source.match(/^(?:export )?function [A-Z]\w*/gm) ?? []).toEqual([]);
    expect(
      source.match(/\bclass\s+\w+\s+extends\s+(?:React\.)?(?:Pure)?Component\b/g) ?? [],
    ).toEqual([]);
  });
});
