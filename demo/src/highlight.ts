/** A highlighted run of source text; `kind` null is plain text. */
export type Token = { kind: TokenKind | null; text: string };

export type TokenKind =
  | "comment"
  | "string"
  | "keyword"
  | "tag"
  | "attr"
  | "number"
  | "function"
  | "punct";

const KEYWORDS = [
  "import",
  "from",
  "export",
  "function",
  "const",
  "let",
  "return",
  "if",
  "else",
  "true",
  "false",
  "null",
  "new",
  "type",
];

/** Tried in this order at each position; the first match wins. */
const RULES: readonly [TokenKind, RegExp][] = [
  ["comment", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ["string", /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/y],
  // A JSX tag's name, right after `<` or `</`.
  ["tag", /(?<=<\/?)[A-Za-z][\w.]*/y],
  ["keyword", new RegExp(`\\b(?:${KEYWORDS.join("|")})\\b`, "y")],
  ["number", /\b\d+(?:\.\d+)?\b/y],
  // A JSX attribute: a name directly followed by `=` and a `{` or a quote.
  ["attr", /[A-Za-z][\w-]*(?==[{"])/y],
  ["function", /[A-Za-z_$][\w$]*(?=\()/y],
  ["punct", /[{}()[\];,.<>/=+!?:&|]/y],
];

/**
 * Splits TypeScript/TSX source into highlighted tokens for the code tabs: a small, dependency-free
 * tokenizer that's enough for the site's own snippets, not a general-purpose parser. Concatenating
 * every token's text gives back `source` exactly.
 */
export function highlight(source: string): Token[] {
  const tokens: Token[] = [];
  let plain = "";
  let index = 0;
  while (index < source.length) {
    let matched: Token | null = null;
    for (const [kind, rule] of RULES) {
      rule.lastIndex = index;
      const match = rule.exec(source);
      if (match !== null && match[0].length > 0) {
        matched = { kind, text: match[0] };
        break;
      }
    }
    if (matched === null) {
      plain += source[index];
      index += 1;
      continue;
    }
    if (plain !== "") tokens.push({ kind: null, text: plain });
    plain = "";
    tokens.push(matched);
    index += matched.text.length;
  }
  if (plain !== "") tokens.push({ kind: null, text: plain });
  return tokens;
}
