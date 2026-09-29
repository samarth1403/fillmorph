import { FillmorphMarkupError } from "../errors";
import type { ViewBox } from "../icon";

/** One element of the parsed SVG tree. Text content is not kept — only tags and attributes. */
export type SvgElement = {
  name: string;
  attributes: ReadonlyMap<string, string>;
  children: SvgElement[];
  parent: SvgElement | undefined;
};

/** A paint property (`fill` or `stroke`) resolved for one path, plus where the value came from. */
export type ResolvedPaint = {
  value: string;
  /** Element the value was read from, or `undefined` when SVG's own default applied. */
  source: SvgElement | undefined;
};

/** A `<path>` element found by stage 1, with its effective fill and stroke already resolved. */
export type ExtractedPath = {
  element: SvgElement;
  /** Position among all `<path>` elements in document order, starting at 0. */
  index: number;
  /** The raw `d` attribute, unparsed; `undefined` if the element has none. */
  d: string | undefined;
  fill: ResolvedPaint;
  stroke: ResolvedPaint;
};

/** Stage 1 output: the document tree plus every `<path>` in it. */
export type SvgMarkup = {
  root: SvgElement;
  paths: ExtractedPath[];
  /** The root's parsed `viewBox`, or `undefined` if it has none (stage 2 decides what that means). */
  viewBox: ViewBox | undefined;
};

const PAINT_DEFAULTS = { fill: "black", stroke: "none" } as const;

const VIEWBOX_NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

const NAME_PATTERN = /[A-Za-z_:À-￿][\w.:\-·À-￿]*/y;
const PREDEFINED_ENTITIES: Readonly<Record<string, string>> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

/**
 * Stage 1: parses full SVG markup (`<svg ...>...</svg>`) into an element tree and extracts every
 * `<path>` element with its `d` string and effective fill/stroke.
 *
 * Source-agnostic and content-neutral: it succeeds on any well-formed SVG containing at least one
 * `<path>`, whether or not the icon is morphable. It only reads tags and attributes; it does not
 * touch the DOM, resolve external DTDs, or apply CSS from `<style>` elements.
 *
 * @throws FillmorphMarkupError if the markup is not well-formed XML, its root is not `<svg>`, or
 *   it contains no `<path>` element.
 */
export function parseSvgMarkup(markup: string): SvgMarkup {
  if (typeof markup !== "string") {
    throw new FillmorphMarkupError(
      `Expected the icon's SVG markup as a string, but received ${typeof markup}.`,
    );
  }
  const root = parseXmlTree(markup);
  if (root.name !== "svg") {
    throw new FillmorphMarkupError(
      `Expected an <svg> root element, but the markup's root element is <${root.name}>. ` +
        "Pass the icon's full <svg>...</svg> markup.",
    );
  }

  const paths: ExtractedPath[] = [];
  const visit = (element: SvgElement): void => {
    if (element.name === "path") {
      paths.push({
        element,
        index: paths.length,
        d: element.attributes.get("d"),
        fill: resolvePaint(element, "fill"),
        stroke: resolvePaint(element, "stroke"),
      });
    }
    for (const child of element.children) visit(child);
  };
  visit(root);

  if (paths.length === 0) {
    throw new FillmorphMarkupError(
      "The SVG contains no <path> element. fillmorph reads icon geometry from <path> elements.",
    );
  }
  return { root, paths, viewBox: parseViewBox(root.attributes.get("viewBox")) };
}

/**
 * Parses a `viewBox` attribute: four numbers separated by whitespace and/or a comma. A value
 * that doesn't fit that grammar, or has a negative width or height (an error per the SVG spec),
 * is malformed SVG. A zero size is syntactically valid and left for stage 2 to judge.
 */
function parseViewBox(raw: string | undefined): ViewBox | undefined {
  if (raw === undefined) return undefined;
  const parts = raw.trim().split(/\s*,\s*|\s+/);
  const numbers = parts.map((part) =>
    VIEWBOX_NUMBER_PATTERN.test(part) ? Number(part) : Number.NaN,
  );
  const [x, y, width, height] = numbers;
  if (
    numbers.length !== 4 ||
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    !numbers.every(Number.isFinite)
  ) {
    throw new FillmorphMarkupError(
      `The <svg> root's viewBox="${raw}" is malformed: expected four numbers "min-x min-y width height".`,
    );
  }
  if (width < 0 || height < 0) {
    throw new FillmorphMarkupError(
      `The <svg> root's viewBox="${raw}" has a negative width or height, which SVG doesn't allow.`,
    );
  }
  return { x, y, width, height };
}

/** A presentation property's value on one element, and which syntax set it. */
export type PresentationValue = { value: string; via: "style" | "attribute" };

/**
 * Reads a presentation property (`fill`, `transform`, `clip-path`, …) from one element, whichever
 * way it was written: an inline `style` declaration beats the element's own attribute, as in CSS.
 * Every check that reads such a property goes through here, so a rule can never see only the
 * attribute form while the same property set via `style="…"` slips past it.
 */
export function readPresentationValue(
  element: SvgElement,
  property: string,
): PresentationValue | undefined {
  const fromStyle = readStyleDeclaration(element.attributes.get("style"), property);
  if (fromStyle !== undefined && fromStyle !== "") return { value: fromStyle, via: "style" };
  const fromAttribute = element.attributes.get(property)?.trim();
  if (fromAttribute !== undefined && fromAttribute !== "") {
    return { value: fromAttribute, via: "attribute" };
  }
  return undefined;
}

/**
 * Resolves a paint property the way SVG inheritance does: the nearest element on the path's
 * ancestor chain (the path itself first, the `<svg>` root last) that sets it wins, else SVG's
 * default. On each element an inline `style` declaration beats the presentation attribute, as
 * in CSS. `inherit` defers to the next ancestor.
 */
function resolvePaint(path: SvgElement, property: "fill" | "stroke"): ResolvedPaint {
  for (let element: SvgElement | undefined = path; element; element = element.parent) {
    const value = readPresentationValue(element, property)?.value;
    if (value !== undefined && value.toLowerCase() !== "inherit") {
      return { value, source: element };
    }
  }
  return { value: PAINT_DEFAULTS[property], source: undefined };
}

function readStyleDeclaration(style: string | undefined, property: string): string | undefined {
  if (style === undefined) return undefined;
  let found: string | undefined;
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) continue;
    if (declaration.slice(0, colon).trim().toLowerCase() === property) {
      // Later declarations win, as in CSS; `!important` has no competitor inside one attribute.
      found = declaration
        .slice(colon + 1)
        .replace(/!\s*important\s*$/i, "")
        .trim();
    }
  }
  return found;
}

function parseXmlTree(source: string): SvgElement {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const stack: SvgElement[] = [];
  let root: SvgElement | undefined;
  let i = 0;

  const fail: (message: string) => never = (message) => {
    const line = text.slice(0, i).split("\n").length;
    throw new FillmorphMarkupError(`Malformed SVG markup (line ${line}): ${message}`);
  };
  const skipPast = (terminator: string, what: string): void => {
    const end = text.indexOf(terminator, i);
    if (end === -1) fail(`unterminated ${what}.`);
    i = end + terminator.length;
  };
  const readName = (what: string): string => {
    NAME_PATTERN.lastIndex = i;
    const match = NAME_PATTERN.exec(text);
    if (!match) return fail(`expected ${what} at "${text.slice(i, i + 20)}".`);
    i = NAME_PATTERN.lastIndex;
    return match[0];
  };
  const skipWhitespace = (): boolean => {
    const start = i;
    while (i < text.length && isXmlWhitespace(text.charCodeAt(i))) i++;
    return i > start;
  };

  while (i < text.length) {
    if (text.startsWith("<!--", i)) {
      i += 4;
      skipPast("-->", "comment (missing -->)");
    } else if (text.startsWith("<![CDATA[", i)) {
      if (stack.length === 0) fail("CDATA section outside the root element.");
      i += 9;
      skipPast("]]>", "CDATA section (missing ]]>)");
    } else if (text.startsWith("<!DOCTYPE", i)) {
      if (root || stack.length > 0) fail("<!DOCTYPE> must come before the root element.");
      skipDoctype();
    } else if (text.startsWith("<?", i)) {
      i += 2;
      skipPast("?>", "processing instruction (missing ?>)");
    } else if (text.startsWith("</", i)) {
      i += 2;
      const name = readName("a closing tag name");
      skipWhitespace();
      if (text[i] !== ">") fail(`expected ">" to finish </${name}>.`);
      i++;
      const open = stack.pop();
      if (!open) fail(`closing tag </${name}> has no matching opening tag.`);
      else if (open.name !== name) fail(`<${open.name}> is closed by </${name}>.`);
    } else if (text[i] === "<") {
      i++;
      if (root && stack.length === 0) fail("more than one root element.");
      const { node, isSelfClosing } = readStartTag();
      if (!root) root = node;
      if (!isSelfClosing) stack.push(node);
    } else {
      const next = text.indexOf("<", i);
      const end = next === -1 ? text.length : next;
      const content = text.slice(i, end);
      if (stack.length === 0 && content.trim() !== "") {
        fail(`text "${content.trim().slice(0, 20)}" outside the root element.`);
      }
      decodeEntities(content, fail);
      i = end;
    }
  }

  if (stack.length > 0) fail(`<${stack[stack.length - 1]?.name}> is never closed.`);
  if (!root) return fail("no root element found.");
  return root;

  function readStartTag(): { node: SvgElement; isSelfClosing: boolean } {
    const name = readName("an element name after <");
    const attributes = new Map<string, string>();
    for (;;) {
      const hadWhitespace = skipWhitespace();
      if (text.startsWith("/>", i)) {
        i += 2;
        return { node: attach(name, attributes), isSelfClosing: true };
      }
      if (text[i] === ">") {
        i++;
        return { node: attach(name, attributes), isSelfClosing: false };
      }
      if (i >= text.length) fail(`<${name}> tag is never finished.`);
      if (!hadWhitespace) fail(`expected whitespace between attributes in <${name}>.`);
      const attributeName = readName(`an attribute name in <${name}>`);
      skipWhitespace();
      if (text[i] !== "=") fail(`attribute "${attributeName}" in <${name}> has no value.`);
      i++;
      skipWhitespace();
      const quote = text[i];
      if (quote !== '"' && quote !== "'") {
        fail(`attribute "${attributeName}" in <${name}> is not quoted.`);
      }
      const end = text.indexOf(quote, i + 1);
      if (end === -1) fail(`attribute "${attributeName}" in <${name}> is never closed.`);
      const raw = text.slice(i + 1, end);
      if (raw.includes("<")) fail(`attribute "${attributeName}" in <${name}> contains "<".`);
      if (attributes.has(attributeName)) {
        fail(`attribute "${attributeName}" appears twice in <${name}>.`);
      }
      attributes.set(attributeName, decodeEntities(raw, fail));
      i = end + 1;
    }
  }

  function attach(name: string, attributes: Map<string, string>): SvgElement {
    const parent = stack[stack.length - 1];
    const node: SvgElement = { name, attributes, children: [], parent };
    parent?.children.push(node);
    return node;
  }

  function skipDoctype(): void {
    i += "<!DOCTYPE".length;
    let bracketDepth = 0;
    while (i < text.length) {
      const char = text[i];
      if (char === '"' || char === "'") {
        const end = text.indexOf(char, i + 1);
        if (end === -1) fail("unterminated quoted string in <!DOCTYPE>.");
        i = end + 1;
        continue;
      }
      i++;
      if (char === "[") bracketDepth++;
      else if (char === "]") bracketDepth--;
      else if (char === ">" && bracketDepth === 0) return;
    }
    fail("unterminated <!DOCTYPE>.");
  }
}

/**
 * Decodes the five predefined XML entities and numeric character references. Other named
 * references (e.g. ones declared in an Illustrator export's internal DTD) are left verbatim, since
 * resolving DTDs is out of scope; a bare `&` that isn't a reference at all is malformed XML.
 */
function decodeEntities(raw: string, fail: (message: string) => never): string {
  if (!raw.includes("&")) return raw;
  return raw.replace(/&([^;&\s<]*);?/g, (whole, body: string) => {
    if (!whole.endsWith(";") || body === "") {
      return fail(`"&" must start an entity reference like "&amp;".`);
    }
    if (body.startsWith("#")) {
      const hex = /^#x([0-9a-fA-F]+)$/.exec(body)?.[1];
      const decimal = /^#([0-9]+)$/.exec(body)?.[1];
      const codePoint =
        hex !== undefined
          ? Number.parseInt(hex, 16)
          : decimal !== undefined
            ? Number.parseInt(decimal, 10)
            : Number.NaN;
      if (!(codePoint >= 0 && codePoint <= 0x10ffff)) {
        return fail(`invalid character reference "${whole}".`);
      }
      return String.fromCodePoint(codePoint);
    }
    return PREDEFINED_ENTITIES[body] ?? whole;
  });
}

function isXmlWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}
