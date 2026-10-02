import { describe, expect, it } from "vitest";
import { matchingPreset, SPRING_PRESETS, SPRING_SLIDERS } from "./presets";

describe("spring presets and sliders", () => {
  it("keeps every preset inside the sliders' ranges, on their steps", () => {
    for (const preset of SPRING_PRESETS) {
      for (const slider of SPRING_SLIDERS) {
        const value = preset.config[slider.key];
        expect(value).toBeGreaterThanOrEqual(slider.min);
        expect(value).toBeLessThanOrEqual(slider.max);
        const steps = (value - slider.min) / slider.step;
        expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
      }
    }
  });

  it("names a preset only when the values match it exactly", () => {
    const bouncy = SPRING_PRESETS[2];
    expect(bouncy && matchingPreset(bouncy.config)?.name).toBe("bouncy");
    expect(matchingPreset({ stiffness: 300, damping: 13, mass: 1 })).toBeUndefined();
  });
});
