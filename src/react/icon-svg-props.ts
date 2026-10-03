import type { CSSProperties } from "react";

/**
 * An icon element's root `<svg>` attributes as React props (spec 09, 0.2.1), for `<FillMorph>` to
 * apply to its own `<svg>`. Values are the attribute strings, except `style`, which is an object.
 */
export type IconSvgProps = Readonly<Record<string, string | CSSProperties>>;

/**
 * Root attributes fillmorph keeps for itself, because they set up the frame it draws in rather
 * than how the shape looks: its `viewBox` is always the canonical `0 0 100 100`, so the icon's own
 * `viewBox` and `preserveAspectRatio` would misplace the drawing; `x`/`y` would move the frame
 * inside an outer `<svg>`; `overflow` stays visible so a spring's overshoot isn't clipped (spec 06);
 * and `id` would repeat on every `<FillMorph>` showing the same icon, making DOM ids collide. Plus
 * `xmlns`/`xmlns:*`, `version` and `baseProfile`, which only matter to a standalone SVG document.
 */
const OWNED_ATTRIBUTES = new Set([
  "viewBox",
  "preserveAspectRatio",
  "x",
  "y",
  "overflow",
  "id",
  "xmlns",
  "version",
  "baseProfile",
]);

/**
 * HTML-style lowercase attribute names React renders whose prop name isn't their camelCase form.
 * This is React's own naming, not any icon library's: every other name converts mechanically.
 */
const LOWERCASE_PROP_NAMES: Readonly<Record<string, string>> = {
  class: "className",
  tabindex: "tabIndex",
  autofocus: "autoFocus",
  accesskey: "accessKey",
  contenteditable: "contentEditable",
  spellcheck: "spellCheck",
  autocapitalize: "autoCapitalize",
  enterkeyhint: "enterKeyHint",
  inputmode: "inputMode",
  crossorigin: "crossOrigin",
  itemprop: "itemProp",
  itemscope: "itemScope",
  itemtype: "itemType",
  itemid: "itemID",
  itemref: "itemRef",
};

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return ENTITIES[body.toLowerCase()] ?? entity;
  });
}

/**
 * The root `<svg>` start tag's attributes, in order, from `renderToStaticMarkup` output (which
 * always double-quotes values and escapes quotes inside them), or `null` if the root isn't `<svg>`.
 */
export function readRootSvgAttributes(markup: string): [name: string, value: string][] | null {
  const tag = /^\s*<svg(\s[^>]*)?\/?>/.exec(markup);
  if (tag === null) return null;
  const attributes: [string, string][] = [];
  for (const match of (tag[1] ?? "").matchAll(/([^\s=/"'>]+)(?:="([^"]*)")?/g)) {
    const name = match[1];
    if (name !== undefined) attributes.push([name, decodeEntities(match[2] ?? "")]);
  }
  return attributes;
}

/** `stroke-width` → `strokeWidth`, `xlink:href` → `xlinkHref`; `aria-*`/`data-*` stay as they are. */
function toPropName(attribute: string): string {
  if (attribute.startsWith("aria-") || attribute.startsWith("data-")) return attribute;
  const lowercase = LOWERCASE_PROP_NAMES[attribute];
  if (lowercase !== undefined) return lowercase;
  return attribute.replace(/[-:]([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** `background-color` → `backgroundColor`, `-webkit-x` → `WebkitX`, `-ms-x` → `msX`, `--x` kept. */
function toStyleKey(property: string): string {
  if (property.startsWith("--")) return property;
  const unprefixed = property.startsWith("-ms-") ? property.slice(1) : property;
  return unprefixed.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** A `style` attribute as a React style object, splitting on `;` outside quotes and parentheses. */
function parseStyle(style: string): CSSProperties {
  const declarations: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (const char of style) {
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === ";" && depth === 0) {
      declarations.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  declarations.push(current);
  const result: Record<string, string> = {};
  for (const declaration of declarations) {
    const colon = declaration.indexOf(":");
    if (colon <= 0) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (property !== "" && value !== "") result[toStyleKey(property)] = value;
  }
  return result;
}

/**
 * Everything on an icon element's rendered root `<svg>` except what fillmorph owns (see
 * `OWNED_ATTRIBUTES`), as React props. Generic on purpose: it reads the rendered attributes, never
 * a library's own prop names (`color`, `size`, …), so any icon library works without fillmorph
 * knowing about it. `null` if the markup's root isn't an `<svg>`.
 */
export function toIconSvgProps(markup: string): IconSvgProps | null {
  const attributes = readRootSvgAttributes(markup);
  if (attributes === null) return null;
  const props: Record<string, string | CSSProperties> = {};
  for (const [name, value] of attributes) {
    if (OWNED_ATTRIBUTES.has(name) || name.startsWith("xmlns:")) continue;
    props[toPropName(name)] = name === "style" ? parseStyle(value) : value;
  }
  return props;
}

/**
 * The props for `<FillMorph>`'s `<svg>`: the icon's forwarded props, with every prop the caller
 * passed `<FillMorph>` directly winning, except `className` and `style`, which combine (the
 * icon's first, so the caller's style wins any property both set). A prop passed as `undefined`
 * counts as not passed, as React treats it.
 */
export function mergeSvgProps<Props extends object>(
  icon: IconSvgProps | null,
  explicit: Props,
): Props {
  if (icon === null) return explicit;
  const merged: Record<string, unknown> = { ...icon };
  for (const [key, value] of Object.entries(explicit)) {
    if (value !== undefined) merged[key] = value;
  }
  const iconClass = icon.className;
  const explicitClass = (explicit as { className?: unknown }).className;
  if (typeof iconClass === "string" && typeof explicitClass === "string") {
    merged.className = `${iconClass} ${explicitClass}`;
  }
  const iconStyle = icon.style;
  const explicitStyle = (explicit as { style?: unknown }).style;
  if (
    typeof iconStyle === "object" &&
    typeof explicitStyle === "object" &&
    explicitStyle !== null
  ) {
    merged.style = { ...iconStyle, ...explicitStyle };
  }
  return merged as Props;
}
