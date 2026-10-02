import reactCode from "./like-button.tsx?raw";
import { JS_MARK, REACT_MARK } from "../sections/framework-mark";
import vanillaCode from "./like-button-vanilla.ts?raw";

/** One tab of the "Get started" code: a real source file, type-checked with the demo. */
export type Snippet = {
  id: "react" | "vanilla";
  label: string;
  file: string;
  code: string;
  /** The binding's mark for the tab (see `framework-mark.tsx` for its license terms). */
  mark: string;
};

/**
 * The code tabs (spec 08 §1b #10): React and Vanilla JS only, since those are the two bindings
 * that ship. Each is the text of a file next to this one, which `pnpm typecheck` compiles
 * against the real public API, so the page can't show code that has drifted from it.
 */
export const SNIPPETS: readonly Snippet[] = [
  { id: "react", label: "React", file: "Like.tsx", code: reactCode.trimEnd(), mark: REACT_MARK },
  {
    id: "vanilla",
    label: "Vanilla JS",
    file: "like.ts",
    code: vanillaCode.trimEnd(),
    mark: JS_MARK,
  },
];
