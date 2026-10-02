import { CANONICAL_VIEW_BOX, parseIcon, renderContours } from "fillmorph";
import type { ReactElement } from "react";

const VIEW_BOX = [
  CANONICAL_VIEW_BOX.x,
  CANONICAL_VIEW_BOX.y,
  CANONICAL_VIEW_BOX.width,
  CANONICAL_VIEW_BOX.height,
].join(" ");

/** Parsed once per icon: the picker and the wall redraw the same 61 icons on every render. */
const pathCache = new Map<string, string>();

function pathFor(markup: string): string {
  let path = pathCache.get(markup);
  if (path === undefined) {
    path = renderContours(parseIcon(markup).contours);
    pathCache.set(markup, path);
  }
  return path;
}

/**
 * An icon drawn still, through the same parse and canonical frame `<FillMorph>` uses, so a static
 * tile and a morphing one line up exactly when one replaces the other. Decorative: the button or
 * list item around it carries the accessible name.
 */
export const StaticIcon = ({
  markup,
  className,
}: {
  markup: string;
  className?: string;
}): ReactElement => {
  return (
    <svg
      viewBox={VIEW_BOX}
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={pathFor(markup)} />
    </svg>
  );
};
