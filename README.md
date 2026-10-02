# fillmorph

Morph filled SVG icons into each other, holes and all, with real spring physics.

fillmorph reshapes one filled icon into another: solid shapes, outlines, rings, and icons with
cutouts like a padlock's keyhole or the counters of a **B**. The shape itself changes; there's no
crossfade and no icon swap. Holes open, close and move as part of the morph, and interrupting a
morph mid-flight turns it toward the new icon without a snap.

**Live demo and playground:** <!-- TODO(maintainer): the demo's public URL, once deployed. -->
_link coming with the first deployment._ Until then, run it from a clone with `pnpm install &&
pnpm demo:dev`.

**It's for filled icons, not stroke icons.** Icons drawn as a stroked centerline (Lucide, Tabler,
Feather) are a different problem, which existing libraries already handle; fillmorph rejects them
with a clear error rather than morphing them badly. See [Icon requirements](#icon-requirements).

## Install

```sh
npm install fillmorph
```

One package, three entry points:

| Import            | What it is                                                         | Needs     |
| ----------------- | ------------------------------------------------------------------ | --------- |
| `fillmorph`       | Core: parsing, interpolation, spring math. No DOM.                 | nothing   |
| `fillmorph/dom`   | `createMorphDriver`: runs a morph frame by frame in the browser.   | nothing   |
| `fillmorph/react` | `<FillMorph>` and `useFillMorph`.                                  | React ≥18 |

Zero runtime dependencies; React is an optional peer, needed only for `fillmorph/react`. ESM only,
with TypeScript types included. Unminified ESM, gzipped: core 15.2 KB, dom 0.6 KB, react 2.1 KB
(measured on the 0.1.0 build).

## Quickstart

Icons are passed as their **full SVG markup**, exactly as copied from the icon set (with Vite, for
example, `import heart from "./heart.svg?raw"`).

### React

```tsx
import { FillMorph } from "fillmorph/react";
import { heartOutline, heartSolid } from "./icons"; // <svg> markup strings

export const Like = ({ liked }: { liked: boolean }) => {
  return <FillMorph icon={liked ? heartSolid : heartOutline} />;
};
```

Change `icon` and it morphs from whatever is on screen. Change it again mid-morph and it turns
toward the new icon without a snap.

### Vanilla JS

```ts
import { parseIcon, renderContours } from "fillmorph";
import { createMorphDriver } from "fillmorph/dom";
import { heartOutline, heartSolid } from "./icons"; // <svg> markup strings

const path = document.querySelector("#like path") as SVGPathElement; // in <svg viewBox="0 0 100 100">
const outline = parseIcon(heartOutline).contours;
const solid = parseIcon(heartSolid).contours;

const driver = createMorphDriver(outline, solid);
driver.subscribe((shape) => path.setAttribute("d", renderContours(shape)));
```

Call `driver.retarget(outline)` later to morph back.

## API

### `<FillMorph>` (`fillmorph/react`)

| Prop           | Type                                | Notes                                                                                 |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `icon`         | `string`                            | Full SVG markup. Changing it morphs to the new icon.                                  |
| `springConfig` | `{ stiffness, damping, mass }`      | Optional. Defaults to `{ stiffness: 170, damping: 26, mass: 1 }`.                     |
| `onError`      | `(error: FillmorphError) => void`   | Optional. Gets parse rejections; without it they're thrown for an error boundary.     |
| `progress`     | `number`                            | Controlled mode: draw `icon` → `to` at this progress (clamped to 0–1). No animation.  |
| `to`           | `string`                            | Controlled mode only: the icon at `progress` 1.                                       |
| `ref`          | `{ morphTo(icon: string) }`         | Imperative: morph to an icon without changing the `icon` prop (uncontrolled only).    |

Any other SVG attribute (`className`, `fill`, `width`, `aria-label`, …) goes to the rendered
`<svg>`, which is drawn in a `0 0 100 100` frame. Pass `fill="currentColor"` to follow the text
color. The `<svg>` allows overflow by default, so an overshooting spring isn't clipped.

`useFillMorph(icon, springConfig?)` is the hook `<FillMorph>` is built on, for drawing the shape
yourself (canvas, composed SVG): it returns `{ contours, retarget, error }`.

### Spring feel

`springConfig` takes the spring's physical constants. The demo's three presets are good starting
points (they're values to copy, not exports):

| Feel   | `springConfig`                                | Character                                  |
| ------ | --------------------------------------------- | ------------------------------------------ |
| Smooth | `{ stiffness: 120, damping: 22, mass: 1 }`    | Calm, about 0.9 s, no overshoot.            |
| Snappy | `{ stiffness: 260, damping: 32, mass: 1 }`    | Quick, no overshoot.                        |
| Bouncy | `{ stiffness: 160, damping: 12, mass: 1 }`    | Overshoots and settles.                     |

Higher `stiffness` is faster; higher `damping` bounces less; higher `mass` is heavier and slower.
When a spring overshoots, fillmorph never extrapolates the geometry (that would turn a closing hole
inside out): once the morph arrives, the finished icon swells and shrinks slightly with the bounce
instead.

### `createMorphDriver` (`fillmorph/dom`)

```ts
createMorphDriver(from: Contour[], to: Contour[], config?: SpringConfig): {
  retarget(to: Contour[]): void;            // morph toward a new icon from the shape on screen
  subscribe(listener: (shape: Contour[]) => void): () => void;  // called every frame; returns unsubscribe
  stop(): void;                             // pause where it is
}
```

It runs on `requestAnimationFrame` and never touches the DOM itself: your listener draws the shape,
usually with `renderContours`.

### Core (`fillmorph`)

| Export                                         | What it does                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `parseIcon(svg)`                               | Parses SVG markup into `{ contours, viewBox }`, contours in a `0 0 100 100` frame. Throws a typed error for icons outside the requirements. |
| `interpolate(from, to, progress)`              | The shape between two parsed icons at `progress` 0–1.                          |
| `renderContours(contours)`                     | An SVG path `d` string for a shape.                                            |
| `startMorph` / `advanceMorph` / `retargetMorph` | The pure spring-driven morph state machine the driver runs, for custom loops. |
| `stepSpring(state, config, target, dt)`        | One exact step of the damped spring.                                           |
| `CANONICAL_VIEW_BOX`                           | The `0 0 100 100` frame every shape is drawn in.                               |
| `FillmorphMarkupError`, `FillmorphParseError`, `FillmorphIncompatibleIconError` | What `parseIcon` throws: not SVG, unreadable path data, or outside the requirements. |

See each export's TSDoc for the details.

## Icon requirements

fillmorph morphs icons that are **filled shapes drawn with `<path>`**:

- **Filled, not stroked.** A path whose effective `fill` is `none` (a stroke icon) is rejected.
- **Closed paths** only, with a `viewBox` (or plain numeric `width` and `height`).
- **Holes nested one level deep:** an outline, holes in it, and shapes inside those holes (a ring
  with a dot). Deeper nesting parses but isn't guaranteed to morph well.
- **Plain SVG:** no `<circle>`/`<rect>`/other shapes, `<style>`, `transform`, `<use>`, gradients,
  masks or clip paths. Either `fill-rule` works.

Anything outside this is a parse-time error naming the problem, never a silent bad morph. Most
Font Awesome Free solid and regular icons fit as they are: 365 of the 379 we tried (the rest nest
too deeply, or have a zero-area subpath).

## Known limitation: complex and highly concave outlines

Morphs between very complex or highly concave icon outlines can show geometry artifacts mid-morph:
an outline briefly crossing itself, or a hole briefly poking outside its shape. The start and end
shapes are always exact; the artifacts appear only in between.

This is measured, not estimated. We morphed every ordered pair from a pool of 365 Font Awesome Free
6.7.2 icons that fillmorph accepts (all 163 Regular icons plus 216 common Solid ones, less 14 it
rejects) and ran each morph through the project's geometry checks at 11 points along the way. 42%
of pairs (56,436 of 132,860) failed at least one check. Failures concentrate on intricate or
deeply concave outlines (for example paperclip, at, headphones, music, folder-open, floppy-disk),
which fail against most other icons.

The 164 icons in the demo are verified clean: every ordered pair among them (26,732 morphs) passes
every check. To check your own icon set the same way, run `pnpm harness --vet-icons <folder>` from
a clone of this repository.

## License

MIT. See [LICENSE](LICENSE).
