import { renderContours } from "fillmorph";
import type { CheckResult } from "../checks/check-result.ts";
import { canonicalViewBoxAttribute } from "../display.ts";
import { formatNumber } from "../geometry.ts";
import { escapeHtml, renderCheckList, renderPage } from "../html.ts";
import type { AutoTuneResult } from "./auto-tune.ts";
import type { PlaybackTrace } from "./runner.ts";

/** One pair's recorded playback, ready to render. */
export type PlaybackSection = {
  title: string;
  subtitle: string;
  trace: PlaybackTrace;
  checks: CheckResult[];
  tuning: AutoTuneResult | null;
};

function describeTuning(section: PlaybackSection): string {
  const { config } = section.trace;
  const used = `stiffness ${formatNumber(config.stiffness)}, damping ${formatNumber(config.damping)}, mass ${formatNumber(config.mass)}`;
  const tuning = section.tuning;
  if (tuning === null) return `Spring config: ${used}.`;
  if (tuning.baseConfigPassed)
    return `Spring config: ${used} (the starting config already passed; unchanged).`;
  if (tuning.config === null) {
    return `Auto-tuning found no passing config among ${tuning.candidates.length} candidates; showing the starting config (${used}).`;
  }
  return `Spring config: ${used} (auto-tuned from the starting config; ${tuning.candidates.length} candidates tried).`;
}

function renderSection(section: PlaybackSection, index: number): string {
  const frames = section.trace.entries.map((entry) => ({
    t: entry.time,
    p: entry.position,
    leg: entry.leg,
    d: renderContours(entry.contours),
  }));
  const interruptions = section.trace.interruptions.map(
    (interruption) => interruption.time,
  );
  // "<" is escaped so no frame data can close the <script> element early.
  const data = JSON.stringify({ frames, interruptions }).replaceAll(
    "<",
    "\\u003c",
  );
  const first = frames[0]?.d ?? "";
  const passed = section.checks.every((check) => check.passed);
  const status = passed
    ? `<span class="pass">PASS</span>`
    : `<span class="fail">FAIL</span>`;
  return `<section>
<h2>${status} ${escapeHtml(section.title)}</h2>
<p class="meta">${escapeHtml(section.subtitle)}<br>${escapeHtml(describeTuning(section))}</p>
<div data-player="playback-data-${index}" style="max-width:320px">
<svg class="tile" viewBox="${canonicalViewBoxAttribute()}"><path d="${first}" fill="black"/></svg>
<p><button type="button">Play</button>
<select aria-label="Playback speed"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option><option value="0.1">0.1×</option></select></p>
<input type="range" min="0" max="${Math.max(frames.length - 1, 0)}" value="0" aria-label="Scrub frames" style="width:100%">
<p class="readout"><code></code></p>
</div>
<script type="application/json" id="playback-data-${index}">${data}</script>
${renderCheckList(section.checks)}
</section>`;
}

/**
 * Replays each recorded trace at its recorded simulated times with `requestAnimationFrame`. It
 * never re-runs the spring: the page only shows frames the harness already recorded and checked.
 */
const PLAYER_SCRIPT = `
for (const player of document.querySelectorAll("[data-player]")) {
  const data = JSON.parse(document.getElementById(player.dataset.player).textContent);
  const path = player.querySelector("path");
  const button = player.querySelector("button");
  const speed = player.querySelector("select");
  const scrubber = player.querySelector("input");
  const readout = player.querySelector(".readout code");
  let start = null;
  let request = 0;
  const show = (index) => {
    const frame = data.frames[index];
    path.setAttribute("d", frame.d);
    scrubber.value = String(index);
    const retarget = data.interruptions.includes(frame.t) ? "  ← interruption" : "";
    readout.textContent = "t=" + frame.t.toFixed(3) + "s  p=" + frame.p.toFixed(3) + "  leg " + (frame.leg + 1) + retarget;
  };
  const tick = (now) => {
    if (start === null) start = now;
    const elapsed = ((now - start) / 1000) * Number(speed.value);
    let index = 0;
    while (index + 1 < data.frames.length && data.frames[index + 1].t <= elapsed) index++;
    show(index);
    if (index + 1 < data.frames.length) request = requestAnimationFrame(tick);
    else button.textContent = "Replay";
  };
  button.addEventListener("click", () => {
    cancelAnimationFrame(request);
    start = null;
    button.textContent = "Playing…";
    request = requestAnimationFrame(tick);
  });
  scrubber.addEventListener("input", () => {
    cancelAnimationFrame(request);
    button.textContent = "Play";
    show(Number(scrubber.value));
  });
  show(0);
}
`;

/**
 * Deliverable #7's human-watchable output: a dependency-free HTML/SVG page that embeds each
 * recorded trace (every frame's path data and timestamp) and replays it in real time with plain
 * inline JavaScript, plus a scrubber for stepping frame by frame.
 */
export function renderPlaybackPage(
  sections: readonly PlaybackSection[],
  lede: string,
): string {
  const body = `<h1>fillmorph harness - real-time playback</h1>
<p class="lede">${escapeHtml(lede)}</p>
${sections.map(renderSection).join("\n")}`;
  return renderPage("Harness playback", body, PLAYER_SCRIPT);
}
