import type { SpringConfig } from "fillmorph";

/**
 * `text` as the body of a JavaScript template literal: backslashes, backticks and `${` are escaped,
 * so any pasted markup (license comments, CSS, anything) comes back out unchanged.
 */
export function templateLiteralBody(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * The playground's "copy your component" output (spec 08 §1d #4): a ready-to-paste React component,
 * written as an arrow function component like all the project's components (§1h #2), morphing
 * between two icons with `springConfig` filled in. `demo/src/snippets/generated-example.tsx`
 * is this function's output for the playground's default pair, compiled by `pnpm typecheck`, and
 * `codegen.test.ts` keeps the two identical, so the template can't drift from the real API.
 * (`generateVanillaScript` is checked the same way, against `generated-example-vanilla.ts`.)
 */
export function generateReactComponent(from: string, to: string, spring: SpringConfig): string {
  return `import { FillMorph } from "fillmorph/react";
import { useState } from "react";

const FROM = \`${templateLiteralBody(from.trim())}\`;

const TO = \`${templateLiteralBody(to.trim())}\`;

export const MorphingIcon = () => {
  const [isOn, setIsOn] = useState(false);
  return (
    <button type="button" aria-label="Toggle icon" aria-pressed={isOn} onClick={() => setIsOn(!isOn)}>
      <FillMorph
        icon={isOn ? TO : FROM}
        springConfig={{ stiffness: ${spring.stiffness}, damping: ${spring.damping}, mass: ${spring.mass} }}
        fill="currentColor"
        width={48}
        height={48}
        aria-hidden="true"
      />
    </button>
  );
};
`;
}

/**
 * The paste tool's Vanilla JS output (spec 08 §1e #5): the same toggle with `fillmorph/dom`'s
 * driver, written in the style of the "Get started" vanilla example. The markup it expects is in
 * its first comment.
 */
export function generateVanillaScript(from: string, to: string, spring: SpringConfig): string {
  return `import { parseIcon, renderContours } from "fillmorph";
import { createMorphDriver } from "fillmorph/dom";

const FROM = \`${templateLiteralBody(from.trim())}\`;

const TO = \`${templateLiteralBody(to.trim())}\`;

// <button id="morph" aria-label="Toggle icon"><svg viewBox="0 0 100 100" width="48" height="48" fill="currentColor" overflow="visible"><path /></svg></button>
const button = document.querySelector("#morph") as HTMLButtonElement;
const path = button.querySelector("path") as SVGPathElement;
const from = parseIcon(FROM).contours;
const to = parseIcon(TO).contours;

const driver = createMorphDriver(from, from, { stiffness: ${spring.stiffness}, damping: ${spring.damping}, mass: ${spring.mass} });
driver.subscribe((shape) => path.setAttribute("d", renderContours(shape)));

let isOn = false;
button.addEventListener("click", () => {
  isOn = !isOn;
  button.setAttribute("aria-pressed", String(isOn));
  driver.retarget(isOn ? to : from);
});
`;
}
