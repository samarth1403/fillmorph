import { type Contour, type ParsedIcon, parseIcon, renderContours } from "fillmorph";
import { canonicalViewBoxAttribute, wrapInSvg } from "./display.ts";
import { formatNumber } from "./geometry.ts";
import { escapeHtml, renderPage, svgDataUri } from "./html.ts";

/**
 * `renderContours` writes 3 decimal places, so a faithful re-parse lands within half a step
 * (5e-4) of every original point, plus floating-point noise (1e-9); anything beyond that means
 * the rendered path doesn't encode the parsed contours.
 */
const REPARSE_TOLERANCE = 5e-4 + 1e-9;

/** The static round-trip check for one icon (spec 02's Definition of done). */
export type RoundTripResult = {
  name: string;
  source: string;
  parsed: ParsedIcon;
  /** The parsed contours rendered by `renderContours`. */
  d: string;
  /**
   * Automated companion to the visual check: `d`, wrapped in the canonical frame and parsed
   * again, must give back the same tree and points (to within the rounding step). Null when the
   * re-parse itself failed.
   */
  maxReparseDeviation: number | null;
  problems: string[];
  passed: boolean;
};

function compareReparse(
  original: Contour[],
  reparsed: Contour[],
): {
  deviation: number;
  problems: string[];
} {
  const problems: string[] = [];
  let deviation = 0;
  if (reparsed.length !== original.length) {
    problems.push(`re-parse gave ${reparsed.length} contours, expected ${original.length}`);
  }
  for (const [index, source] of original.entries()) {
    const copy = reparsed[index];
    if (copy === undefined) break;
    const sameTree =
      copy.id === source.id &&
      copy.parentId === source.parentId &&
      copy.isHole === source.isHole &&
      copy.depth === source.depth;
    if (!sameTree) problems.push(`contour ${source.id}: id/parentId/isHole/depth changed`);
    if (copy.points.length !== source.points.length) {
      problems.push(
        `contour ${source.id}: ${copy.points.length} points after re-parse, expected ${source.points.length}`,
      );
      continue;
    }
    for (const [pointIndex, point] of source.points.entries()) {
      const copied = copy.points[pointIndex] as Contour["points"][number];
      deviation = Math.max(deviation, Math.abs(copied.x - point.x), Math.abs(copied.y - point.y));
    }
  }
  if (deviation > REPARSE_TOLERANCE) {
    problems.push(
      `points moved by up to ${deviation} after re-parse (tolerance ${REPARSE_TOLERANCE})`,
    );
  }
  return { deviation, problems };
}

/** Parses `source`, renders it with `renderContours`, and re-parses the rendering. */
export function runRoundTrip(name: string, source: string): RoundTripResult {
  const parsed = parseIcon(source);
  const d = renderContours(parsed.contours);
  try {
    const reparsed = parseIcon(wrapInSvg(d)).contours;
    const { deviation, problems } = compareReparse(parsed.contours, reparsed);
    return {
      name,
      source,
      parsed,
      d,
      maxReparseDeviation: deviation,
      problems,
      passed: problems.length === 0,
    };
  } catch (error) {
    const problem = `re-parse threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
    return {
      name,
      source,
      parsed,
      d,
      maxReparseDeviation: null,
      problems: [problem],
      passed: false,
    };
  }
}

function describeTree(parsed: ParsedIcon): string {
  const holes = parsed.contours.filter((contour) => contour.isHole).length;
  const maxDepth = Math.max(...parsed.contours.map((contour) => contour.depth));
  const { width, height } = parsed.viewBox;
  return `viewBox ${formatNumber(width)} × ${formatNumber(height)} · ${parsed.contours.length} contours · ${holes} holes · max depth ${maxDepth}`;
}

function renderRow(result: RoundTripResult): string {
  const status = result.passed
    ? `<span class="pass">PASS</span>`
    : `<span class="fail">FAIL</span>`;
  const deviation =
    result.maxReparseDeviation === null ? "n/a" : formatNumber(result.maxReparseDeviation, 6);
  const problems =
    result.problems.length === 0
      ? ""
      : `<ul class="details">${result.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("")}</ul>`;
  // The overlay draws the parsed outline in red over the untouched source, in the same square
  // viewport, so any offset, scale or missing hole shows up as red off the black edge.
  const overlay = `<div class="tile" style="position:relative">
<img src="${svgDataUri(result.source)}" alt="" style="position:absolute;inset:0;width:100%;height:100%">
<svg viewBox="${canonicalViewBoxAttribute()}" style="position:absolute;inset:0;width:100%;height:100%"><path d="${result.d}" fill="none" stroke="#e53935" stroke-width="0.35"/></svg>
</div>`;
  return `<section>
<h2>${status} ${escapeHtml(result.name)}</h2>
<p class="meta">${escapeHtml(describeTree(result.parsed))} · re-parse max deviation ${deviation}</p>
<div class="grid" style="grid-template-columns: repeat(3, minmax(0, 240px))">
<figure><img class="tile" src="${svgDataUri(result.source)}" alt=""><figcaption>source, own viewBox</figcaption></figure>
<figure><img class="tile" src="${svgDataUri(wrapInSvg(result.d))}" alt=""><figcaption>parsed, canonical frame</figcaption></figure>
<figure>${overlay}<figcaption>overlay: parsed outline on source</figcaption></figure>
</div>
${problems}
</section>`;
}

/**
 * Spec 02's static round-trip check, as spec 03's Definition of done specifies it: each icon's
 * untouched source (its own `viewBox`, default `preserveAspectRatio`) next to its parsed contours
 * rendered in the display wrapper's canonical frame, in same-size square viewports. No
 * un-normalizing: the canonical mapping *is* the default square fit, so a correct parse lines up.
 */
export function renderRoundTripPage(results: readonly RoundTripResult[]): string {
  const body = `<h1>fillmorph harness — spec 02 round-trip check</h1>
<p class="lede">Each row: the source icon drawn standalone in a square viewport with its own viewBox, the parsed contours drawn via <code>renderContours</code> in the canonical frame at the same size, and the parsed outline overlaid in red on the source. A correct parse lines up exactly, holes included, and a non-square source is letterboxed identically.</p>
${results.map(renderRow).join("\n")}`;
  return renderPage("Spec 02 round-trip check", body);
}
