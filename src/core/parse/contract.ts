import {
  FillmorphIncompatibleIconError,
  FillmorphMarkupError,
} from "../errors";
import type { ViewBox } from "../icon";
import {
  type ExtractedPath,
  type PresentationValue,
  type ResolvedPaint,
  readPresentationValue,
  resolvePaint,
  type SvgElement,
  type SvgMarkup,
} from "./markup";

/**
 * Elements whose subtree never renders on its own (it only matters when referenced, and every
 * way of referencing it into the shape - `<use>`, a `url()` fill, `mask`, `clip-path` - is
 * rejected separately), plus purely descriptive elements. Their contents are ignored.
 */
const NON_RENDERING_ELEMENTS = new Set([
  "defs",
  "title",
  "desc",
  "metadata",
  "symbol",
  "linearGradient",
  "radialGradient",
  "pattern",
  "mask",
  "clipPath",
  "marker",
  "filter",
]);

const SHAPE_REFERENCE_PROPERTIES = ["mask", "clip-path"] as const;

/** Elements that draw with `fill`/`stroke` alone, so their paint says whether they draw at all. */
const GEOMETRY_ELEMENTS = new Set([
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
]);

const STROKE_ICON_ADVICE =
  "fillmorph works with filled icons only. This looks like a stroke/outline icon (as in Lucide " +
  "or Tabler); use a filled icon instead.";

/** A root `width`/`height` attribute usable as a user-unit size: a plain number, optionally `px`. */
const USER_UNIT_LENGTH_PATTERN =
  /^\s*((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?:px)?\s*$/;

/** A bare number with no unit - valid as an SVG attribute, but invalid (and ignored) in CSS. */
const UNITLESS_NUMBER_PATTERN =
  /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?\s*$/;

/** Stage 2 contract output: what renders, and the frame it renders in. */
export type IconContract = {
  /** The `<path>` elements that actually render, in document order. */
  paths: ExtractedPath[];
  viewBox: ViewBox;
};

/**
 * Stage 2, contract half: decides whether a well-formed SVG is the kind of icon fillmorph
 * morphs - filled `<path>` geometry with nothing that would make the rendered shape differ from
 * the paths' own `d` data. Does not look inside `d`; geometry validity is checked afterwards.
 *
 * Checks run in a fixed order so the most useful message wins: a stroke icon is reported as a
 * stroke icon even if it also contains, say, a `<circle>`. The icon's frame (`viewBox`) is
 * checked last.
 *
 * Two rules keep a check from being sidestepped by how the SVG happens to be written:
 * - Every presentation property (`transform`, `mask`, `clip-path`, root `width`/`height`, CSS
 *   `d`) is read through `readPresentationValue`, so an inline `style` declaration is judged
 *   exactly like the attribute it overrides.
 * - Checks for things that affect rendering from anywhere in the document (`<style>`, `<use>`)
 *   search the whole tree, not just the rendered subtree, since a stylesheet inside `<defs>`
 *   still styles the paths outside it.
 *
 * @throws FillmorphIncompatibleIconError naming the first mismatch found.
 * @throws FillmorphMarkupError if the SVG has no `<path>` at all and isn't a stroke icon.
 */
export function validateIconContract(markup: SvgMarkup): IconContract {
  const tree: RenderedTree = {
    elements: new Set(),
    problems: [],
    strokeOnlyShape: undefined,
    hasFilledShape: false,
  };
  collectRendered(markup.root, true, tree);

  // Elements that draw nothing (`display: none`, or no fill and no visible stroke) were skipped
  // by `collectRendered` (spec 10 #1), so Material Design's invisible bounding-box
  // `<path d="M0 0h24v24H0z" fill="none"/>` is no evidence of anything. A `fill: none` path left
  // here draws a visible stroke: a stroke icon, or a filled icon with a stroked outline that
  // fillmorph would silently drop - rejected either way.
  const renderedPaths = markup.paths.filter((path) =>
    tree.elements.has(path.element),
  );
  for (const path of renderedPaths) {
    if (isNone(path.fill.value)) {
      throw new FillmorphIncompatibleIconError(
        `${describePath(path)} has fill: none, stroke: ${path.stroke.value} ` +
          `(${describeSources(path.element, path.fill, path.stroke)}) - ${STROKE_ICON_ADVICE}`,
      );
    }
  }
  // A stroke-only non-path shape (Lucide's `Circle` is only a `<circle>`) is the same diagnosis
  // when nothing in the icon is filled. Next to filled geometry it's just an unsupported element,
  // reported below like any other.
  const strokeOnly = tree.strokeOnlyShape;
  if (strokeOnly !== undefined && !tree.hasFilledShape) {
    throw new FillmorphIncompatibleIconError(
      `A <${strokeOnly.element.name}> element has fill: none, stroke: ${strokeOnly.stroke.value} ` +
        `(${describeSources(strokeOnly.element, strokeOnly.fill, strokeOnly.stroke)}) - ${STROKE_ICON_ADVICE}`,
    );
  }

  // Judged here rather than by stage 1, so the stroke diagnosis above wins for a path-less icon.
  if (markup.paths.length === 0) {
    throw new FillmorphMarkupError(
      "The SVG contains no <path> element. fillmorph reads icon geometry from <path> elements.",
    );
  }

  if (findElement(markup.root, isStyleElement)) {
    throw new FillmorphIncompatibleIconError(
      "The SVG contains a <style> element - fillmorph can't resolve stylesheet rules, so it can't " +
        "tell whether the icon is filled. Export the icon with fill set as attributes instead.",
    );
  }

  const firstProblem = tree.problems[0];
  if (firstProblem !== undefined)
    throw new FillmorphIncompatibleIconError(firstProblem);

  const useElement = findElement(
    markup.root,
    (element) => element.name === "use",
  );
  if (useElement) {
    throw new FillmorphIncompatibleIconError(
      "The SVG contains a <use> element - fillmorph can't morph shapes reused by reference. " +
        "Export the icon with every shape written out as a <path>.",
    );
  }

  for (const path of renderedPaths) {
    if (/^url\s*\(/i.test(path.fill.value)) {
      throw new FillmorphIncompatibleIconError(
        `${describePath(path)} has fill: ${path.fill.value} - gradient and pattern fills aren't ` +
          "supported; fillmorph works with solid-filled icons only.",
      );
    }
  }

  if (renderedPaths.length === 0) {
    throw new FillmorphIncompatibleIconError(
      "None of the SVG's <path> elements draws anything: each is inside a non-rendering " +
        "container (such as <defs>), hidden with display: none, or has neither a fill nor a " +
        "visible stroke. The icon draws nothing fillmorph can morph.",
    );
  }
  return { paths: renderedPaths, viewBox: resolveViewBox(markup) };
}

/**
 * The icon's frame: its `viewBox` if it has one. Without one, SVG draws user units 1:1 onto a
 * viewport of the root's `width` × `height` from the origin, so `{ x: 0, y: 0, width, height }`
 * is the exact equivalent - provided both are plain user-unit numbers. Relative sizes (`%`,
 * `em`) depend on the embedding page, and with neither attribute browsers fall back to an
 * arbitrary 300×150 viewport, so both of those are rejected rather than guessed at.
 *
 * `width`/`height` in the root's inline `style` override the attributes, as in CSS, and are
 * read the same way. The one difference is CSS syntax: a unitless number (`width: 24`) is
 * invalid CSS that browsers ignore, so it falls through to the attribute, while a `px` length
 * is used and any other CSS value (`%`, `em`, `auto`) wins but can't be resolved, so it is
 * rejected.
 */
function resolveViewBox(markup: SvgMarkup): ViewBox {
  if (markup.viewBox !== undefined) {
    if (markup.viewBox.width === 0 || markup.viewBox.height === 0) {
      throw new FillmorphIncompatibleIconError(
        `The <svg> root's viewBox="${markup.root.attributes.get("viewBox")}" has zero width or ` +
          "height, so the icon renders nothing.",
      );
    }
    return markup.viewBox;
  }

  const rawWidth = readRootLength(markup.root, "width");
  const rawHeight = readRootLength(markup.root, "height");
  const width = parseUserUnitLength(rawWidth?.value);
  const height = parseUserUnitLength(rawHeight?.value);
  if (width === undefined || height === undefined) {
    const found =
      rawWidth === undefined && rawHeight === undefined
        ? "no width or height either"
        : `${describeLength("width", rawWidth)} and ${describeLength("height", rawHeight)}, ` +
          "which aren't both plain positive numbers";
    throw new FillmorphIncompatibleIconError(
      `The <svg> root has no viewBox and ${found}, so fillmorph can't tell what frame the ` +
        'icon is drawn in. Add a viewBox (e.g. viewBox="0 0 24 24") to the <svg> root.',
    );
  }
  return { x: 0, y: 0, width, height };
}

/** The root's effective `width`/`height`, skipping a `style` value that CSS itself would ignore. */
function readRootLength(
  root: SvgElement,
  property: "width" | "height",
): PresentationValue | undefined {
  const value = readPresentationValue(root, property);
  if (value?.via === "style" && UNITLESS_NUMBER_PATTERN.test(value.value)) {
    const fromAttribute = root.attributes.get(property)?.trim();
    return fromAttribute
      ? { value: fromAttribute, via: "attribute" }
      : undefined;
  }
  return value;
}

function describeLength(
  property: string,
  length: PresentationValue | undefined,
): string {
  if (length === undefined) return `no ${property}`;
  return length.via === "style"
    ? `style="${property}: ${length.value}"`
    : `${property}="${length.value}"`;
}

function parseUserUnitLength(raw: string | undefined): number | undefined {
  const match = raw === undefined ? null : USER_UNIT_LENGTH_PATTERN.exec(raw);
  const value = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** A geometry element's resolved paint, for the stroke-icon diagnosis. */
type ShapePaint = {
  element: SvgElement;
  fill: ResolvedPaint;
  stroke: ResolvedPaint;
};

/** What `collectRendered` learns from walking the rendered tree. */
type RenderedTree = {
  /** Elements that render and draw something, `<path>`s included. */
  elements: Set<SvgElement>;
  problems: string[];
  /** The first non-`<path>` shape that draws only a stroke (`fill: none`, visible stroke). */
  strokeOnlyShape: ShapePaint | undefined;
  /** Whether any drawn shape (`<path>` or not) has a fill. */
  hasFilledShape: boolean;
};

/**
 * Collects the elements that render and draw something, skipping - before any other check, so
 * they're evidence of nothing - every element that draws nothing (spec 10 #1):
 * - `display: none`, with its whole subtree;
 * - a geometry element with `fill: none` and no visible stroke.
 */
function collectRendered(
  element: SvgElement,
  isRoot: boolean,
  tree: RenderedTree,
): void {
  if (
    NON_RENDERING_ELEMENTS.has(element.name) ||
    isForeignNamespace(element.name)
  )
    return;
  if (isNone(readPresentationValue(element, "display")?.value)) return;

  if (GEOMETRY_ELEMENTS.has(element.name)) {
    const paint: ShapePaint = {
      element,
      fill: resolvePaint(element, "fill"),
      stroke: resolvePaint(element, "stroke"),
    };
    // A `<line>` has no interior, so its fill never draws.
    const isFilled = element.name !== "line" && !isNone(paint.fill.value);
    if (!isFilled && !hasVisibleStroke(element, paint.stroke)) return;
    if (isFilled) tree.hasFilledShape = true;
    else if (element.name !== "path") tree.strokeOnlyShape ??= paint;
  }

  const { problems } = tree;
  const isSupported =
    element.name === "g" ||
    element.name === "path" ||
    (element.name === "svg" && isRoot);
  if (!isSupported) {
    // `<use>` gets its own, more specific message from the document-wide search below, so it
    // isn't reported here as an unsupported shape. (`<style>` never reaches this report: the
    // document-wide `<style>` check throws before rendered-tree problems are reported.)
    if (element.name !== "use") {
      problems.push(
        `The SVG contains a <${element.name}> element - fillmorph morphs <path> geometry only. ` +
          `Convert the <${element.name}> to a <path> (most editors call this "object to path").`,
      );
    }
    return;
  }

  const transform = readPresentationValue(element, "transform");
  if (transform !== undefined && transform.value.toLowerCase() !== "none") {
    problems.push(
      `A <${element.name}> element has ${describeProperty("transform", transform)} - fillmorph ` +
        "doesn't apply transforms. Flatten the transform into the path data before exporting.",
    );
    return;
  }
  for (const property of SHAPE_REFERENCE_PROPERTIES) {
    const reference = readPresentationValue(element, property);
    if (reference !== undefined && reference.value.toLowerCase() !== "none") {
      problems.push(
        `A <${element.name}> element has ${describeProperty(property, reference)} - masks and ` +
          "clip paths aren't supported, since they change the shape beyond what the path data " +
          "describes.",
      );
      return;
    }
  }
  // CSS `d` (e.g. `style="d: path('…')"`) replaces the `d` attribute in browsers that support
  // it; fillmorph only reads the attribute, so geometry set this way would silently be ignored.
  if (element.name === "path") {
    const cssGeometry = readPresentationValue(element, "d");
    if (cssGeometry?.via === "style") {
      problems.push(
        `A <path> element sets its geometry through ${describeProperty("d", cssGeometry)} - ` +
          'fillmorph reads path geometry from the "d" attribute only. Move the path data into ' +
          "the d attribute.",
      );
      return;
    }
  }

  tree.elements.add(element);
  for (const child of element.children) collectRendered(child, false, tree);
}

/**
 * Whether a stroke actually paints: a color other than `none`, at a width other than 0.
 * react-icons renders `stroke="currentColor" stroke-width="0"` on every `<svg>` root, so a
 * colour alone isn't enough.
 */
function hasVisibleStroke(element: SvgElement, stroke: ResolvedPaint): boolean {
  if (isNone(stroke.value)) return false;
  return Number.parseFloat(resolvePaint(element, "stroke-width").value) !== 0;
}

function isNone(value: string | undefined): boolean {
  return value?.toLowerCase() === "none";
}

/** Editor metadata such as `sodipodi:namedview` or `rdf:RDF` lives in a foreign namespace. */
function isForeignNamespace(name: string): boolean {
  return name.includes(":") && !name.startsWith("svg:");
}

/** `<style>`, including an SVG-namespace-prefixed `<svg:style>`. */
function isStyleElement(element: SvgElement): boolean {
  return element.name === "style" || element.name === "svg:style";
}

/** Searches the *whole* document, including non-rendering containers like `<defs>`. */
function findElement(
  element: SvgElement,
  matches: (element: SvgElement) => boolean,
): SvgElement | undefined {
  if (matches(element)) return element;
  for (const child of element.children) {
    const found = findElement(child, matches);
    if (found) return found;
  }
  return undefined;
}

/** Quotes a property the way the author wrote it: `transform="…"` or `style="transform: …"`. */
function describeProperty(property: string, value: PresentationValue): string {
  return value.via === "style"
    ? `style="${property}: ${value.value}"`
    : `${property}="${value.value}"`;
}

/** Human-readable label for a path in error messages, e.g. `<path> #2 (id="dot")`. */
export function describePath(path: ExtractedPath): string {
  const id = path.element.attributes.get("id");
  return `<path> #${path.index + 1}${id === undefined ? "" : ` (id="${id}")`}`;
}

function describeSources(
  element: SvgElement,
  fill: ResolvedPaint,
  stroke: ResolvedPaint,
): string {
  const describe = (paint: ResolvedPaint): string =>
    paint.source === undefined
      ? "SVG default"
      : paint.source === element
        ? `set on the ${element.name === "path" ? "path" : `<${element.name}>`}`
        : `inherited from <${paint.source.name}>`;
  const fillSource = describe(fill);
  const strokeSource = describe(stroke);
  return fillSource === strokeSource
    ? `both ${fillSource}`
    : `fill ${fillSource}, stroke ${strokeSource}`;
}
