import type { ReactElement } from "react";
import jsMark from "../assets/fa-brands-js.svg?raw";
import reactMark from "../assets/fa-brands-react.svg?raw";

/**
 * Font Awesome Free brand icons (CC BY 4.0). FA's license allows brand marks only "to represent
 * the company, product, or service to which they refer", which is exactly this use: labeling
 * React code and JavaScript code.
 */
export const REACT_MARK = reactMark;
export const JS_MARK = jsMark;

/** A framework's mark in front of a tab label, in that framework's color. */
export const FrameworkMark = ({
  markup,
  framework,
}: {
  markup: string;
  framework: "react" | "vanilla";
}): ReactElement => {
  return (
    <span
      aria-hidden="true"
      className={`size-4 [&_svg]:size-full [&_svg]:fill-current ${framework === "react" ? "text-sky-500" : "text-yellow-500"}`}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: our own vendored, static Font Awesome brand file.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};
