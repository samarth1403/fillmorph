/**
 * SVG markup fixtures for spec 02's tests. The Font Awesome and Lucide icons are verbatim copies
 * of the published files (`@fortawesome/fontawesome-free@6.7.2/svgs/...`, CC BY 4.0, and
 * `lucide-static@0.469.0/icons/...`, ISC), so the tests exercise real-world markup conventions
 * rather than hand-simplified approximations. Everything under "Custom" was drawn for these tests.
 */

// Font Awesome (filled): single-line markup, license comment, no fill attribute (SVG default).

export const FA_SOLID_HEART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2024 Fonticons, Inc. --><path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"/></svg>`;

export const FA_SOLID_CIRCLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2024 Fonticons, Inc. --><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"/></svg>`;

/** A ring: outer r=256 and a hole r=208, both centred on (256, 256). */
export const FA_REGULAR_CIRCLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2024 Fonticons, Inc. --><path d="M464 256A208 208 0 1 0 48 256a208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z"/></svg>`;

/** Five concentric circles, nested to depth 4 — deeper than v1 guarantees. */
export const FA_SOLID_BULLSEYE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2024 Fonticons, Inc. --><path d="M448 256A192 192 0 1 0 64 256a192 192 0 1 0 384 0zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm256 80a80 80 0 1 0 0-160 80 80 0 1 0 0 160zm0-224a144 144 0 1 1 0 288 144 144 0 1 1 0-288zM224 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>`;

// Lucide (stroke): multi-line markup, license comment before the root, fill="none" on <svg>.

export const LUCIDE_HEART = `<!-- @license lucide-static v0.469.0 - ISC -->
<svg
  class="lucide lucide-heart"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
</svg>
`;

/** Contains both a `<circle>` and an open path — but the right diagnosis is "stroke icon". */
export const LUCIDE_CIRCLE_CHECK = `<!-- @license lucide-static v0.469.0 - ISC -->
<svg
  class="lucide lucide-circle-check"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="10" />
  <path d="m9 12 2 2 4-4" />
</svg>
`;

// Custom: an Inkscape-style export — XML declaration, editor namespaces and metadata, a layer
// <g> without a transform, fill set through `style`, relative commands, comma separators, and a
// polyarc ring (outer r=28, hole r=18, centred on (32, 32)).

export const CUSTOM_INKSCAPE_RING = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg
   width="64"
   height="64"
   viewBox="0 0 64 64"
   version="1.1"
   id="svg5"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:dc="http://purl.org/dc/elements/1.1/">
  <title id="title1">Ring &amp; hole</title>
  <sodipodi:namedview id="namedview7" pagecolor="#ffffff" inkscape:zoom="8" />
  <defs id="defs2" />
  <metadata id="metadata1"><rdf:RDF><dc:title>Ring</dc:title></rdf:RDF></metadata>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1">
    <path
       style="fill:#1a1a1a;fill-opacity:1;stroke:none"
       d="m 32,4 a 28,28 0 0 1 28,28 28,28 0 0 1 -28,28 28,28 0 0 1 -28,-28 28,28 0 0 1 28,-28 z m 0,10 a 18,18 0 0 0 -18,18 18,18 0 0 0 18,18 18,18 0 0 0 18,-18 18,18 0 0 0 -18,-18 z"
       id="path1" />
  </g>
</svg>
`;

/**
 * Bullseye at exactly v1's maximum depth: a square outer shape (depth 0), a circular hole
 * (depth 1), and a dot inside the hole (depth 2) drawn as a second `<path>` with cubics.
 */
export const CUSTOM_BULLSEYE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <path d="M0 0H48V48H0Z M24 6A18 18 0 0 0 24 42A18 18 0 0 0 24 6Z"/>
  <path d="M24 16C28.4 16 32 19.6 32 24S28.4 32 24 32 16 28.4 16 24 19.6 16 24 16Z"/>
</svg>`;

/** Letter-"B"-like: one outer shape with two sibling holes at the same depth. */
export const CUSTOM_TWO_HOLES = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60">
  <path fill-rule="evenodd" d="M0 0H40V60H0Z M10 8H30V26H10Z M10 34H30V52H10Z"/>
</svg>`;

// Deliberately broken.

export const BROKEN_MALFORMED_XML = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H10V10Z"></svg>`;

export const BROKEN_OPEN_SUBPATH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M2 2H22V22H2Z M6 6 L18 6 L18 18"/>
</svg>`;

export const BROKEN_DEGENERATE_SUBPATH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M2 2H22V22H2Z M4 12 L12 12 L20 12 Z"/>
</svg>`;

// Stylesheet-styled stroke icons (custom, modeled on Adobe Illustrator's "Presentation
// Attributes: Internal CSS" SVG export). Illustrator puts the stylesheet inside <defs>, so a
// <style> check that skips non-rendering containers would accept these as filled icons.

/** The minimal case that exposed the `<style>`-inside-`<defs>` bug. */
export const STYLESHEET_STROKE_IN_DEFS = `<svg viewBox="0 0 24 24"><defs><style>.cls-1{fill:none;stroke:#000}</style></defs><path class="cls-1" d="M2 2H22V22H2Z"/></svg>`;

/** The same failure mode in Illustrator's full export layout. */
export const ILLUSTRATOR_STYLESHEET_STROKE = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <defs>
    <style>
      .cls-1 {
        fill: none;
        stroke: #000;
        stroke-miterlimit: 10;
        stroke-width: 2px;
      }
    </style>
  </defs>
  <path class="cls-1" d="M12 3 21 12 12 21 3 12Z"/>
</svg>
`;
