<div align="center">

<img src="./demo/public/favicon.svg" width="72" height="72" alt="fillmorph logo" />

# fillmorph

**Morph filled icons into each other - not a crossfade, not a swap.** 🔄

[![npm version](https://img.shields.io/npm/v/fillmorph)](https://www.npmjs.com/package/fillmorph)
[![license](https://img.shields.io/github/license/samarthikkalaki/fillmorph)](LICENSE)
[![live demo](https://img.shields.io/badge/demo-fillmorph.com-orange)](https://fillmorph.com/)

**[🎮 Try the live demo →](https://fillmorph.com/)**

</div>

---

## 🧩 The problem

Apps constantly need an icon to change state - collapsed to expanded, off to on,
unselected to selected. The usual fixes are a crossfade (both icons visible at once,
briefly) or a hard swap (it just jumps). Neither looks like the icon actually _became_
the new one.

fillmorph does that: it reshapes one filled icon's outline into another's, frame by
frame, driven by real spring physics - not a fade, not a swap. If an icon has a hole in
it, the hole opens, closes, or moves as part of the reshape. Change your mind mid-morph
and it bends toward the new target instead of resetting.

> **Why it exists** - [Morphicons](https://morphicons.com) covers _stroke_ (line-drawn)
> icons well, like Lucide or Tabler. fillmorph covers the _filled_-icon case - solid
> shapes, and shapes with holes and cutouts.

You bring your own icons (any filled SVG works - your own design, or exported from any
icon set) - fillmorph doesn't ship a built-in icon library.

## 📋 Table of Contents

1. ✨ [What It Works On](#works-on)
2. 🛠️ [How to Use](#how-to-use)
3. 📦 [Install](#install)
4. 🎛️ [Choose How It Moves](#spring-feel)
5. 📚 [API Reference](#api-reference)
6. 🧾 [Icon Requirements](#icon-requirements)
7. ⚠️ [Known Limitation](#known-limitation)
8. 📄 [License](#license)

## <a name="works-on">✨ What It Works On</a>

- ✅ **Works on:** any filled icon drawn as a closed shape - a solid shape, an outline
  that's actually a filled ring, or a shape with one or more cutouts inside it (think of
  how a hole in a letter or a keyhole in a lock is just an empty space cut out of a solid
  shape). A cutout can even hold a shape of its own, one level deep. Two-tone icons keep
  their faded layer faded.
- 🚫 **Doesn't work on:** icons drawn as strokes/lines rather than fills (the style used
  by icon sets like Lucide, Tabler, or Feather). fillmorph rejects these with a clear
  error immediately, instead of animating them badly - whether you pass the SVG markup or
  a React element like `lucide-react`'s `<Heart />`.

The exact technical rules are in [Icon Requirements](#icon-requirements).

## <a name="how-to-use">🛠️ How to Use</a>

You pass your own icons as **full SVG markup** (a string) - however you get that string
into your code is up to you. With a bundler like Vite, for example:
`import myIcon from "./my-icon.svg?raw"`. In React you can also pass an icon component's
**element** directly, like `<FaHeart />` from `react-icons`.

### ⚛️ React

```tsx
import { FillMorph } from "fillmorph/react";
import { collapsedIcon, expandedIcon } from "./my-icons"; // your own <svg> markup strings

export const Toggle = ({ isOpen }: { isOpen: boolean }) => {
  return <FillMorph icon={isOpen ? expandedIcon : collapsedIcon} />;
};
```

Change the `icon` prop and `<FillMorph>` morphs from whatever's currently on screen to
the new one. Change it again before the morph finishes, and it smoothly redirects toward
the newest target instead of snapping.

Already using an icon library like `react-icons`? Pass its elements straight in - no need
to dig out the SVG markup:

```tsx
import { FillMorph } from "fillmorph/react";
import { FaHeart, FaRegHeart } from "react-icons/fa6";

export const Like = ({ liked }: { liked: boolean }) => {
  return <FillMorph icon={liked ? <FaHeart /> : <FaRegHeart />} />;
};
```

The element is rendered to SVG markup (with `react-dom/server`'s `renderToStaticMarkup`)
and checked exactly like a string, so it has to be a filled icon too. A few things to know:

- **Its look comes along.** Whatever attributes the element puts on its own `<svg>` -
  `fill`, `width`/`height`, `class`, `style`, `aria-*`, `data-*`, whatever your icon library
  uses for color and size - go onto `<FillMorph>`'s `<svg>`. So `<FaHeart color="red"
  size={32} />` morphs red at 32px, with any icon library. Props you pass `<FillMorph>`
  itself win, except `className` and `style`, which combine. fillmorph keeps `viewBox`,
  `preserveAspectRatio`, `x`, `y` and `overflow` for its own drawing frame, and never copies
  `id` (two of the same icon would duplicate it). When the icon changes, its attributes
  switch instantly - only the shape animates.
- **It's rendered on its own,** outside your app's component tree. So context providers
  above `<FillMorph>` (like react-icons' `IconContext.Provider`) don't reach it - only the
  icon's own defaults and the props on the element itself apply.
- **`react-dom/server` loads on first use.** The first time any element icon shows up on a
  page, it waits for that module to load (once per page) and draws nothing new until then.
  After that, elements are as instant as strings. Apps that only pass strings never load it.
- **With server rendering** (Next.js, Remix, etc.), an icon passed as a React element
  is empty in the server-rendered HTML and fills in once the client hydrates. Icons
  passed as strings render normally on the server.

### 🧵 Vanilla JS

```ts
import { parseIcon, renderContours } from "fillmorph";
import { createMorphDriver } from "fillmorph/dom";
import { collapsedIcon, expandedIcon } from "./my-icons"; // your own <svg> markup strings

const path = document.querySelector("#toggle path") as SVGPathElement; // inside <svg viewBox="0 0 100 100">
const from = parseIcon(collapsedIcon).contours;
const to = parseIcon(expandedIcon).contours;

const driver = createMorphDriver(from, to);
driver.subscribe((shape) => path.setAttribute("d", renderContours(shape)));
```

Call `driver.retarget(from)` later to morph back the other way.

For icons with translucent parts (a two-tone icon's faded layer), draw `renderLayers(shape)`
instead: one `<path d fill-opacity>` per layer. For a fully opaque icon it's a single layer
with the same `d` as `renderContours`.

## <a name="install">📦 Install</a>

```sh
npm install fillmorph
```

Use `fillmorph/react` in a React app (React 18+), or `fillmorph/dom` without React. Zero
runtime dependencies - React and React DOM are optional peers, needed only for
`fillmorph/react`.

<details>
<summary>📐 Entry points and package details</summary>

One package, three entry points:

| Import            | What it is                                                       | Needs                    |
| ----------------- | ---------------------------------------------------------------- | ------------------------ |
| `fillmorph`       | Core: parsing, interpolation, spring math. No DOM.               | nothing                  |
| `fillmorph/dom`   | `createMorphDriver`: runs a morph frame by frame in the browser. | nothing                  |
| `fillmorph/react` | `<FillMorph>` and `useFillMorph`.                                | React ≥18, React DOM ≥18 |

ESM and CommonJS, with TypeScript types included. Unminified ESM, gzipped: core 17.0 KB, dom
0.6 KB, react 5.2 KB (measured on the 0.4.0 build). Icon elements need `react-dom/server`, which
`fillmorph/react` loads with a dynamic `import()` only when an element is first used, so
bundlers split it into its own chunk (about 61 KB gzipped with React 19) that string-only
apps never download.

</details>

## <a name="spring-feel">🎛️ Choose How It Moves</a>

The motion is a spring - make it calm, quick, or bouncy by passing `springConfig`. These
three are the demo's presets, good starting points to copy (they're values, not exports):

| Feel      | `springConfig`                             | Character                        |
| --------- | ------------------------------------------ | -------------------------------- |
| 🌊 Smooth | `{ stiffness: 120, damping: 22, mass: 1 }` | Calm, about 0.9 s, no overshoot. |
| ⚡ Snappy | `{ stiffness: 260, damping: 32, mass: 1 }` | Quick, no overshoot.             |
| 🏀 Bouncy | `{ stiffness: 160, damping: 12, mass: 1 }` | Overshoots and settles.          |

Without `springConfig`, it uses `{ stiffness: 170, damping: 26, mass: 1 }`. Higher
`stiffness` is faster; higher `damping` bounces less; higher `mass` is heavier and slower.
When a spring overshoots, fillmorph never extrapolates the geometry (that would turn a
closing hole inside out) - once the morph arrives, the finished icon swells and shrinks
slightly with the bounce instead.

## <a name="api-reference">📚 API Reference</a>

<details>
<summary><code>&lt;FillMorph&gt;</code> props (<code>fillmorph/react</code>)</summary>

| Prop           | Type                              | Notes                                                                                |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `icon`         | `string \| ReactElement`         | Full SVG markup, or an icon element like `<FaHeart />`. Changing it morphs to it.    |
| `springConfig` | `{ stiffness, damping, mass }`    | Optional, all three or none. Defaults to `{ stiffness: 170, damping: 26, mass: 1 }`. |
| `onError`      | `(error: FillmorphError) => void` | Optional. Gets parse rejections; without it they're thrown for an error boundary.    |
| `progress`     | `number`                          | Controlled mode: draw `icon` → `to` at this progress (clamped to 0–1; `NaN` is 0).   |
| `to`           | `string \| ReactElement`         | Controlled mode only: the icon at `progress` 1.                                      |
| `ref`          | `{ morphTo(icon) }`               | Imperative: morph to an icon without changing the `icon` prop (uncontrolled only).   |

Any other SVG attribute (`className`, `fill`, `width`, `aria-label`, …) goes to the
rendered `<svg>`, which is drawn in a `0 0 100 100` frame. Pass `fill="currentColor"` to
follow the text color. The `<svg>` allows overflow by default, so an overshooting spring
isn't clipped. `fillOpacity` (as a prop or in `style`) multiplies with each translucent
layer's own opacity: a two-tone icon's 0.3 layer at `fillOpacity={0.4}` draws at 0.12. A
`fill-opacity` set by a CSS class doesn't reach those layers, since each sets its own.

`useFillMorph(icon, springConfig?)` is the hook `<FillMorph>` is built on, for drawing the
shape yourself (canvas, composed SVG): it returns `{ contours, retarget, error }`.

Everywhere an icon goes (`icon`, `to`, `morphTo`, `useFillMorph`, `retarget`) takes a
string or a React element. Elements are compared by the markup they render, so writing
`icon={<FaHeart />}` inline is fine. Passing something else - most often the component
`FaHeart` instead of the element `<FaHeart />` - is a `FillmorphIconInputError` (exported
from `fillmorph/react`), a kind of `FillmorphMarkupError`, reported like any other bad icon.
So is an element when `react-dom/server` can't be loaded. While the page's first element
icon waits for that load, `useFillMorph` returns empty `contours` with a `null` `error`.

</details>

<details>
<summary><code>createMorphDriver</code> (<code>fillmorph/dom</code>)</summary>

```ts
createMorphDriver(from: Contour[], to: Contour[], config?: SpringConfig): {
  retarget(to: Contour[]): void;            // morph toward a new icon from the shape on screen
  subscribe(listener: (shape: Contour[]) => void): () => void;  // called every frame; returns unsubscribe
  stop(): void;                             // pause where it is
}
```

It runs on `requestAnimationFrame` and never touches the DOM itself: your listener draws
the shape, usually with `renderContours` (or `renderLayers`, for icons with translucent
parts).

</details>

<details>
<summary>Core exports (<code>fillmorph</code>)</summary>

| Export                                                                          | What it does                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseIcon(svg)`                                                                | Parses SVG markup into `{ contours, viewBox }`, contours in a `0 0 100 100` frame. Throws a typed error for icons outside the requirements. |
| `interpolate(from, to, progress)`                                               | The shape between two parsed icons at `progress` 0–1.                                                                                       |
| `renderContours(contours)`                                                      | An SVG path `d` string for a shape.                                                                                                         |
| `renderLayers(contours)`                                                        | `{ d, opacity }[]`, one per opacity, for drawing translucent parts (e.g. two-tone icons) as separate `<path fill-opacity>`s.               |
| `startMorph` / `advanceMorph` / `retargetMorph`                                 | The pure spring-driven morph state machine the driver runs, for custom loops.                                                               |
| `stepSpring(state, config, target, dt)`                                         | One exact step of the damped spring.                                                                                                        |
| `CANONICAL_VIEW_BOX`                                                            | The `0 0 100 100` frame every shape is drawn in.                                                                                            |
| `FillmorphMarkupError`, `FillmorphParseError`, `FillmorphIncompatibleIconError` | What `parseIcon` throws: not SVG, unreadable path data, or outside the requirements.                                                        |
| `isFillmorphError(value)`                                                       | Whether `value` is any fillmorph error, by `name`. Works where `instanceof` doesn't (see below).                                            |

See each export's TSDoc for the details.

fillmorph ships both ESM and CommonJS builds. If an app loads both (some code `import`s
fillmorph while other code, or a dependency, `require`s it), there are two copies of each
error class, and an error from one copy fails `instanceof` against the other's. Use
`isFillmorphError(error)`, then `error.name`, to tell the errors apart in that case.

</details>

## <a name="icon-requirements">🧾 Icon Requirements</a>

fillmorph morphs icons that are **filled shapes drawn with `<path>`**:

- 🎨 **Filled, not stroked.** A shape that draws only a stroke (effective `fill: none` with a
  visible stroke) is rejected as a stroke icon. Elements that draw nothing at all -
  `display="none"`, or `fill="none"` with no visible stroke, like Material Design's invisible
  bounding-box path - are ignored.
- 🔒 **A frame:** a `viewBox` (or plain numeric `width` and `height`).
- 🕳️ **Cutouts nested one level deep:** an outline, cutouts in it, and shapes inside those
  cutouts. Deeper nesting parses but isn't guaranteed to morph well.
- 🧼 **Plain SVG:** no `<circle>`/`<rect>`/other shapes, `<style>`, `transform`, `<use>`,
  gradients, masks or clip paths.

Shapes are read the way a browser fills them. Each path's `fill-rule` (`nonzero` or
`evenodd`) and winding decide what's a cutout, and separate `<path>`s stack on top of each
other, never cutting into one another. A path's `fill-opacity` and `opacity` carry over. A
subpath without `Z` is filled as if closed, and one that encloses no area is skipped. An
icon whose subpaths all cancel each other out (the same shape drawn twice under `evenodd`,
say), which a browser draws blank, is rejected with an error saying so.

Anything outside this is a parse-time error naming the problem, never a silent bad morph.

## <a name="known-limitation">⚠️ Known Limitation: complex and highly concave outlines</a>

Morphs between very complex or highly concave icon outlines can show geometry artifacts
mid-morph: an outline briefly crossing itself, or a hole briefly poking outside its shape.
The start and end shapes are always exact - the artifacts appear only in between.

This is measured, not estimated. Our pool is every Font Awesome Free 6.7.2 Solid and
Regular icon (1,565). fillmorph accepts 1,550 of them, up from 1,534 in 0.2.2, rejecting
14 that nest too deeply and one (`s`) whose outline crosses itself. We took a random
sample of 200,000 of the 2,400,950 ordered pairs of those 1,550 icons. Each morph ran
through the project's geometry checks at 11 points along the way. **52% of sampled
pairs (103,990 of 200,000; ±0.2 percentage points) failed at least one check.** Failures
concentrate on intricate or deeply concave outlines (for example paperclip, at,
floppy-disk, bezier-curve, code-branch, network-wired), which fail against nearly every
other icon. An earlier measurement found 42%, but on a smaller hand-picked pool of more
common icons. On the same pairs, 0.2.2 and 0.3.0 fail at the same rate.

The 164 icons in the demo are verified clean: every ordered pair among them (26,732
morphs) passes every check. To check your own icon set the same way, run
`pnpm harness --vet-icons <folder>` from a clone of this repository.

## <a name="license">📄 License</a>

MIT. See [LICENSE](LICENSE).
