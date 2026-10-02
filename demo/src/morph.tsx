import type { SpringConfig } from "fillmorph";
import { FillMorph } from "fillmorph/react";
import type { ReactElement } from "react";

/**
 * `<FillMorph>` as the page uses it everywhere: drawn in the text color, and either named for
 * assistive tech or hidden from it. (Bouncy's overshoot pop isn't clipped: `<FillMorph>` allows
 * overflow by default.)
 *
 * With `stroke`, the shape is outlined instead of filled, at that width in canonical units, with
 * round caps and joins: how the comparison section draws a stroke icon's line, through the same
 * passthrough props any caller has.
 */
export const Morph = ({
  icon,
  spring,
  className = "",
  label,
  stroke,
}: {
  icon: string;
  spring: SpringConfig;
  className?: string;
  /** Accessible name; without one the icon is decorative and hidden from assistive tech. */
  label?: string;
  stroke?: number;
}): ReactElement => {
  const paint =
    stroke === undefined
      ? { fill: "currentColor" }
      : {
          fill: "none",
          stroke: "currentColor",
          strokeWidth: stroke,
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
        };
  const naming =
    label === undefined
      ? { "aria-hidden": true as const }
      : { role: "img" as const, "aria-label": label };
  return (
    <FillMorph icon={icon} springConfig={spring} className={className} {...paint} {...naming} />
  );
};
