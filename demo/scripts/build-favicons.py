"""Renders the fillmorph brand mark's raster favicons into demo/public/ (spec 08 §1i).

`favicon.svg` is the source of truth: Font Awesome Free's solid fire, filled bottom to top with the
brand orange (Tailwind's orange-500, #ff6900) to yellow-400 (#fdc700). This script draws the same
outline (from demo/scripts/flame-contours.mjs, i.e. fillmorph's own parse of the glyph) with the
same gradient over the shape's bounding box, supersampled 8×, and writes:

- favicon.ico: 16, 32 and 48 px;
- apple-touch-icon.png: 180 px, with a little padding.

Every raster is RGBA with the inner flame a real hole in the alpha channel (and a transparent
background), so the mark sits correctly on any background. The touch icon used to be flattened
onto the dark theme's #0a0a0a, which painted the hole that color (spec 08 §1j #2). iOS still
composites touch icons onto black itself, so on an iPhone the hole and background will look black;
that's the platform, not the file.

Dev-time only: needs Python 3 with Pillow. Run with `pnpm demo:favicons`.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

DEMO = Path(__file__).resolve().parent.parent
BASE_ORANGE = (0xFF, 0x69, 0x00)  # orange-500, the site's brand orange
TIP_YELLOW = (0xFD, 0xC7, 0x00)  # yellow-400
SUPERSAMPLE = 8


def load_contours():
    script = DEMO / "scripts" / "flame-contours.mjs"
    return json.loads(subprocess.run(["node", str(script)], check=True, capture_output=True, text=True).stdout)


def render(contours, size, background=None, padding=0.0):
    big = size * SUPERSAMPLE
    inner, offset = big * (1 - 2 * padding), big * padding
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    # The outline, then its hole (the inner flame) cut back out.
    for contour in sorted(contours, key=lambda c: c["depth"]):
        points = [(offset + x / 100 * inner, offset + y / 100 * inner) for x, y in contour["points"]]
        draw.polygon(points, fill=255 if contour["depth"] % 2 == 0 else 0)
    ys = [y for contour in contours for _, y in contour["points"]]
    top, bottom = min(ys), max(ys)
    column = Image.new("RGB", (1, big))
    for row in range(big):
        y = (row - offset) / inner * 100
        t = min(1.0, max(0.0, (bottom - y) / (bottom - top)))  # 0 at the base, 1 at the tip
        column.putpixel((0, row), tuple(round(b + (a - b) * t) for a, b in zip(TIP_YELLOW, BASE_ORANGE)))
    fill = column.resize((big, big))
    out = Image.new("RGBA", (big, big), (*background, 255) if background else (0, 0, 0, 0))
    out.paste(fill, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def main():
    contours = load_contours()
    public = DEMO / "public"
    icon = render(contours, 256)
    icon.save(public / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    render(contours, 180, padding=0.14).save(public / "apple-touch-icon.png")
    print("wrote", public / "favicon.ico", "and", public / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
