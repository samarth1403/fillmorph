import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";
import { SNIPPETS } from "./snippets";

function kinds(source: string): [string | null, string][] {
  return highlight(source).map((token) => [token.kind, token.text]);
}

describe("highlight", () => {
  it("gives back the source exactly when its tokens are joined", () => {
    for (const snippet of SNIPPETS) {
      expect(
        highlight(snippet.code)
          .map((token) => token.text)
          .join(""),
      ).toBe(snippet.code);
    }
  });

  it("marks keywords, strings and comments", () => {
    expect(kinds('import { a } from "x"; // note')).toEqual([
      ["keyword", "import"],
      [null, " "],
      ["punct", "{"],
      [null, " a "],
      ["punct", "}"],
      [null, " "],
      ["keyword", "from"],
      [null, " "],
      ["string", '"x"'],
      ["punct", ";"],
      [null, " "],
      ["comment", "// note"],
    ]);
  });

  it("marks JSX tag names and attributes, and function calls", () => {
    const tokens = highlight('<FillMorph icon={x} fill="currentColor" />; go(1)');
    expect(tokens).toContainEqual({ kind: "tag", text: "FillMorph" });
    expect(tokens).toContainEqual({ kind: "attr", text: "icon" });
    expect(tokens).toContainEqual({ kind: "attr", text: "fill" });
    expect(tokens).toContainEqual({ kind: "function", text: "go" });
    expect(tokens).toContainEqual({ kind: "number", text: "1" });
  });

  it("doesn't take a keyword out of a longer word", () => {
    expect(highlight("imports constant")).toEqual([{ kind: null, text: "imports constant" }]);
  });
});
