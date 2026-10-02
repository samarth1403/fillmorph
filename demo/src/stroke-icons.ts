import lucideCloud from "./assets/lucide-cloud.svg?raw";
import lucideFolder from "./assets/lucide-folder.svg?raw";
import lucideShield from "./assets/lucide-shield.svg?raw";
import lucideMessage from "./assets/lucide-message-circle.svg?raw";

/**
 * A stroke icon *is* its line. This takes a Lucide icon's single closed `<path>` (its centerline)
 * and wraps it in a filled SVG, only so `<FillMorph>` can carry the line; the comparison section
 * draws it back as Lucide does, a 2-unit round-capped stroke.
 */
export function centerline(lucideMarkup: string): string {
  const d = /\bd="([^"]+)"/.exec(lucideMarkup)?.[1];
  if (d === undefined) throw new Error("Expected a Lucide icon with one <path>");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
}

/** Lucide's 2-unit stroke in its 24-unit frame, in the canonical 100-unit frame. */
export const STROKE_WIDTH = (2 * 100) / 24;

/**
 * The comparison's icons in both styles (lucide-static 0.469.0, ISC; Font Awesome Free 6.7.2
 * solid, CC BY 4.0, all in the vetted set). Chosen in spec 08 §1e, after the earlier heart / star /
 * bookmark / diamond set moved to the swap-vs-morph section. Each Lucide icon here is one closed
 * line (tag, umbrella and bell aren't). Candidates were also dropped when their Font Awesome
 * counterpart isn't in the vetted set (zap's bolt, droplet's droplet) or the lines failed as pairs
 * (flame, against cloud). These four are clean together, which `vetted-pairs.test.ts` checks.
 */
export const BOTH_STYLES: readonly { name: string; stroke: string; filledId: string }[] = [
  { name: "Cloud", stroke: centerline(lucideCloud), filledId: "fa-solid-cloud" },
  { name: "Folder", stroke: centerline(lucideFolder), filledId: "fa-solid-folder" },
  { name: "Shield", stroke: centerline(lucideShield), filledId: "fa-solid-shield" },
  { name: "Chat", stroke: centerline(lucideMessage), filledId: "fa-solid-comment" },
];
