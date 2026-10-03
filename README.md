<div align="center">

<img src="./demo/public/favicon.svg" width="72" height="72" alt="fillmorph logo" />

# fillmorph

**Morph filled icons into each other - not a crossfade, not a swap.** 🔄

[![npm version](https://img.shields.io/npm/v/fillmorph)](https://www.npmjs.com/package/fillmorph)
[![license](https://img.shields.io/github/license/samarth1403/fillmorph)](LICENSE)
[![live demo](https://img.shields.io/badge/demo-fillmorph.vercel.app-orange)](https://fillmorph.vercel.app/)

**[🎮 Try the live demo →](https://fillmorph.vercel.app/)**

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
  shape). A cutout can even hold a shape of its own, one level deep.
- 🚫 **Doesn't work on:** icons drawn as strokes/lines rather than fills (the style used
  by icon sets like Lucide, Tabler, or Feather). fillmorph rejects these with a clear
  error immediately, instead of animating them badly.

The exact technical rules are in [Icon Requirements](#icon-requirements).

## <a name="how-to-use">🛠️ How to Use</a>

In both cases, you pass your own icons as **full SVG markup** (a string) - however you
get that string into your code is up to you. With a bundler like Vite, for example:
`import myIcon from "./my-icon.svg?raw"`.

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

## <a name="install">📦 Install</a>

```sh
npm install fillmorph
```

Use `fillmorph/react` in a React app (React 18+), or `fillmorph/dom` without React. Zero
runtime dependencies - React is an optional peer, needed only for `fillmorph/react`.

<details>
<summary>📐 Entry points and package details</summary>

One package, three entry points:

| Import            | What it is                                                       | Needs     |
| ----------------- | ---------------------------------------------------------------- | --------- |
| `fillmorph`       | Core: parsing, interpolation, spring math. No DOM.               | nothing   |
| `fillmorph/dom`   | `createMorphDriver`: runs a morph frame by frame in the browser. | nothing   |
| `fillmorph/react` | `<FillMorph>` and `useFillMorph`.                                | React ≥18 |

ESM only, with TypeScript types included. Unminified ESM, gzipped: core 15.2 KB, dom 0.6 KB,
react 2.1 KB (measured on the 0.1.0 build).

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
| `icon`         | `string`                          | Full SVG markup. Changing it morphs to the new icon.                                 |
| `springConfig` | `{ stiffness, damping, mass }`    | Optional. Defaults to `{ stiffness: 170, damping: 26, mass: 1 }`.                    |
| `onError`      | `(error: FillmorphError) => void` | Optional. Gets parse rejections; without it they're thrown for an error boundary.    |
| `progress`     | `number`                          | Controlled mode: draw `icon` → `to` at this progress (clamped to 0–1). No animation. |
| `to`           | `string`                          | Controlled mode only: the icon at `progress` 1.                                      |
| `ref`          | `{ morphTo(icon: string) }`       | Imperative: morph to an icon without changing the `icon` prop (uncontrolled only).   |

Any other SVG attribute (`className`, `fill`, `width`, `aria-label`, …) goes to the
rendered `<svg>`, which is drawn in a `0 0 100 100` frame. Pass `fill="currentColor"` to
follow the text color. The `<svg>` allows overflow by default, so an overshooting spring
isn't clipped.

`useFillMorph(icon, springConfig?)` is the hook `<FillMorph>` is built on, for drawing the
shape yourself (canvas, composed SVG): it returns `{ contours, retarget, error }`.

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
the shape, usually with `renderContours`.

</details>

<details>
<summary>Core exports (<code>fillmorph</code>)</summary>

| Export                                                                          | What it does                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseIcon(svg)`                                                                | Parses SVG markup into `{ contours, viewBox }`, contours in a `0 0 100 100` frame. Throws a typed error for icons outside the requirements. |
| `interpolate(from, to, progress)`                                               | The shape between two parsed icons at `progress` 0–1.                                                                                       |
| `renderContours(contours)`                                                      | An SVG path `d` string for a shape.                                                                                                         |
| `startMorph` / `advanceMorph` / `retargetMorph`                                 | The pure spring-driven morph state machine the driver runs, for custom loops.                                                               |
| `stepSpring(state, config, target, dt)`                                         | One exact step of the damped spring.                                                                                                        |
| `CANONICAL_VIEW_BOX`                                                            | The `0 0 100 100` frame every shape is drawn in.                                                                                            |
| `FillmorphMarkupError`, `FillmorphParseError`, `FillmorphIncompatibleIconError` | What `parseIcon` throws: not SVG, unreadable path data, or outside the requirements.                                                        |

See each export's TSDoc for the details.

</details>

## <a name="icon-requirements">🧾 Icon Requirements</a>

fillmorph morphs icons that are **filled shapes drawn with `<path>`**:

- 🎨 **Filled, not stroked.** A path whose effective `fill` is `none` (a stroke icon) is rejected.
- 🔒 **Closed paths** only, with a `viewBox` (or plain numeric `width` and `height`).
- 🕳️ **Cutouts nested one level deep:** an outline, cutouts in it, and shapes inside those
  cutouts. Deeper nesting parses but isn't guaranteed to morph well.
- 🧼 **Plain SVG:** no `<circle>`/`<rect>`/other shapes, `<style>`, `transform`, `<use>`,
  gradients, masks or clip paths. Either `fill-rule` works.

Anything outside this is a parse-time error naming the problem, never a silent bad morph.
Most of Font Awesome Free's solid and regular icons fit as they are: 365 of the 379 we
tried (the rest nest too deeply, or have a zero-area subpath).

## <a name="known-limitation">⚠️ Known Limitation: Complex and Highly Concave Outlines</a>

Morphs between very complex or highly concave icon outlines can show geometry artifacts
mid-morph: an outline briefly crossing itself, or a hole briefly poking outside its shape.
The start and end shapes are always exact - the artifacts appear only in between.

This is measured, not estimated. We morphed every ordered pair from a pool of 365 Font
Awesome Free 6.7.2 icons that fillmorph accepts (all 163 Regular icons plus 216 common
Solid ones, less 14 it rejects) and ran each morph through the project's geometry checks
at 11 points along the way. **42% of pairs (56,436 of 132,860) failed at least one
check.** Failures concentrate on intricate or deeply concave outlines (for example
paperclip, at, headphones, music, folder-open, floppy-disk), which fail against most
other icons.

The 164 icons in the demo are verified clean: every ordered pair among them (26,732
morphs) passes every check. To check your own icon set the same way, run
`pnpm harness --vet-icons <folder>` from a clone of this repository.

## <a name="license">📄 License</a>

MIT. See [LICENSE](LICENSE).
