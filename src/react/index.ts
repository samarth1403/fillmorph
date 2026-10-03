/**
 * `fillmorph/react` — the `<FillMorph>` component and the `useFillMorph` hook it's built on.
 * Depends on `fillmorph` and `fillmorph/dom`; `react` and `react-dom` (for `react-dom/server`,
 * which renders icon elements to markup) are optional peers.
 */
export type { FillMorphHandle, FillMorphProps, FillMorphSvgProps } from "./fill-morph";
export { default, default as FillMorph } from "./fill-morph";
export type { FillMorphIcon } from "./icon-source";
export { FillmorphIconInputError } from "./icon-source";
export type { FillmorphError } from "./parse-icon-markup";
export type { UseFillMorphResult } from "./use-fill-morph";
export { useFillMorph } from "./use-fill-morph";
