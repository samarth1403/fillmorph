import { renderContours } from "fillmorph";
import { wrapInSvg } from "./display.ts";
import { escapeHtml, renderCheckList, renderPage } from "./html.ts";
import type { PairRun } from "./run-pair.ts";

function renderPairSection(run: PairRun): string {
  const flagged = new Set(
    run.checks.flatMap((check) =>
      check.failures.flatMap((failure) => failure.frameIndices),
    ),
  );
  const tiles = run.frames.map((frame, index) => {
    const svg = wrapInSvg(renderContours(frame.contours)).replace(
      "<svg ",
      `<svg class="tile${flagged.has(index) ? " flagged" : ""}" `,
    );
    return `<figure>${svg}<figcaption>${escapeHtml(frame.label)}</figcaption></figure>`;
  });
  const status = run.passed
    ? `<span class="pass">PASS</span>`
    : `<span class="fail">FAIL</span>`;
  return `<section>
<h2>${status} ${escapeHtml(run.pair.name)}</h2>
<p class="meta">${escapeHtml(run.pair.covers)} · <code>${run.pair.from}</code> → <code>${run.pair.to}</code></p>
<div class="grid">${tiles.join("")}</div>
${renderCheckList(run.checks)}
</section>`;
}

/**
 * Spec 03 deliverable #4: one static, dependency-free HTML page showing each pair's whole
 * transition as a grid of inline-SVG frames (canonical frame, square tiles), with the automated
 * check results under each grid. Frames implicated by a failure get a red border.
 */
export function renderFrameGridPage(
  runs: readonly PairRun[],
  morphName: string,
): string {
  const body = `<h1>fillmorph harness - frame grid</h1>
<p class="lede">MorphFn: <code>${escapeHtml(morphName)}</code>. Every frame is drawn in the canonical frame. Passing the automated checks doesn't make a morph look good; the grid is for eyes.</p>
${runs.map(renderPairSection).join("\n")}`;
  return renderPage("Harness frame grid", body);
}
