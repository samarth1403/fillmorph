import type { CheckResult } from "./checks/check-result.ts";

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** An SVG document as an `<img src>` value, so it renders standalone with its own `viewBox`. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const STYLES = `
  body { font: 14px/1.45 system-ui, sans-serif; margin: 24px; color: #1a1a1a; background: #f4f4f2; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 2px; }
  .lede { color: #555; margin: 0 0 20px; max-width: 72ch; }
  section { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 0 0 20px; }
  .meta { color: #666; margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #444; text-align: center; margin-top: 4px; }
  .tile { display: block; width: 100%; aspect-ratio: 1; background: #fff; border: 1px solid #ccc; box-sizing: border-box; }
  .tile.flagged { border: 2px solid #c62828; }
  .checks { list-style: none; padding: 0; margin: 12px 0 0; }
  .checks > li { margin: 4px 0; }
  .pass { color: #1b5e20; font-weight: 600; }
  .fail { color: #c62828; font-weight: 600; }
  .note { color: #666; }
  .details { margin: 2px 0 6px 18px; padding: 0; font-size: 12px; }
  code { font: 12px ui-monospace, monospace; }
`;

/** A complete, dependency-free HTML page. */
export function renderPage(title: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
${body}
${script === "" ? "" : `<script>${script}</script>`}
</body>
</html>
`;
}

/** Caps how many failures of one check are listed, so a badly failing run stays readable. */
const MAX_LISTED_FAILURES = 12;

/** A pass/fail list of check results, with each failure's message. */
export function renderCheckList(checks: readonly CheckResult[]): string {
  const items = checks.map((check) => {
    const status = check.passed
      ? `<span class="pass">PASS</span>`
      : `<span class="fail">FAIL</span> (${check.failures.length})`;
    const listed = check.failures.slice(0, MAX_LISTED_FAILURES).map((failure) => failure.message);
    if (check.failures.length > listed.length) {
      listed.push(`… and ${check.failures.length - listed.length} more`);
    }
    const lines = [
      ...listed.map((message) => `<li>${escapeHtml(message)}</li>`),
      ...check.notes.map((note) => `<li class="note">${escapeHtml(note)}</li>`),
    ];
    const details = lines.length > 0 ? `<ul class="details">${lines.join("")}</ul>` : "";
    return `<li>${status} <code>${check.check}</code>${details}</li>`;
  });
  return `<ul class="checks">${items.join("")}</ul>`;
}
