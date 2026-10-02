import type { SpringConfig } from "fillmorph";

export type PresetName = "smooth" | "snappy" | "bouncy";

/** A named spring feel for the playground (spec 08 #1). */
export type SpringPreset = { name: PresetName; label: string; config: SpringConfig };

/**
 * The playground's three feels. Each was run through spec 03's playback harness as a fixed config
 * (`pnpm harness --all --playback --spring k,c,m`) and a retarget sweep on all five reference
 * pairs, and passed every check.
 *
 * - **Smooth:** ζ ≈ 1.00 at a low stiffness: calm, about 0.9 s, no overshoot.
 * - **Snappy:** ζ ≈ 0.99 at a higher stiffness: quick (about 0.4 s of visible motion), no
 *   overshoot. Retuned from 400/40, whose visible change was over in about 0.25 s and read as a
 *   cut (spec 08 §1b #7).
 * - **Bouncy:** ζ ≈ 0.47, so the spring overshoots (about 18%) and oscillates. Core never
 *   extrapolates the geometry past the target: once arrived it draws the target popped by the
 *   overshoot (spec 05's third and fourth reopens), so the bounce is visible and every hole stays
 *   the right way round. Lowered from 300 (ζ ≈ 0.35, 31% overshoot), which bounced too much and
 *   finished too fast (spec 08 §1d).
 */
export const SPRING_PRESETS: readonly SpringPreset[] = [
  { name: "smooth", label: "Smooth", config: { stiffness: 120, damping: 22, mass: 1 } },
  { name: "snappy", label: "Snappy", config: { stiffness: 260, damping: 32, mass: 1 } },
  { name: "bouncy", label: "Bouncy", config: { stiffness: 160, damping: 12, mass: 1 } },
];

/** fillmorph/dom's default feel (ζ ≈ 1.00), for the hero loop: lively without overshooting. */
export const HERO_SPRING: SpringConfig = { stiffness: 170, damping: 26, mass: 1 };

/** Slower and critically damped, for the icon wall's unattended background morphs. */
export const AMBIENT_SPRING: SpringConfig = { stiffness: 60, damping: 15.5, mass: 1 };

/** One playground slider: a `SpringConfig` field and the range a visitor may set it to. */
export type SpringSlider = {
  key: keyof SpringConfig;
  label: string;
  min: number;
  max: number;
  step: number;
};

/**
 * The playground's slider ranges (spec 08 §1c #4). Every corner of this box (each field at its min
 * or max) passes spec 03's geometry checks across the retarget sweep and settles in under 3 s, so
 * the extremes feel extreme without looking broken. The presets all sit inside it.
 */
export const SPRING_SLIDERS: readonly SpringSlider[] = [
  { key: "stiffness", label: "Stiffness", min: 80, max: 600, step: 10 },
  { key: "damping", label: "Damping", min: 10, max: 34, step: 1 },
  { key: "mass", label: "Mass", min: 0.5, max: 2, step: 0.1 },
];

/** The preset whose values `config` matches exactly, if any. */
export function matchingPreset(config: SpringConfig): SpringPreset | undefined {
  return SPRING_PRESETS.find(
    (preset) =>
      preset.config.stiffness === config.stiffness &&
      preset.config.damping === config.damping &&
      preset.config.mass === config.mass,
  );
}
