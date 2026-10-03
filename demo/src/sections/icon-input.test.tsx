// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IconInput } from "./icon-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let unmount: () => void;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<IconInput />));
  unmount = () => act(() => root.unmount());
});

afterEach(() => {
  unmount();
  container.remove();
});

const button = (label: string): HTMLButtonElement => {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (found === null) throw new Error(`No button labelled ${label}`);
  return found;
};
const svgIn = (element: Element): SVGSVGElement => {
  const svg = element.querySelector("svg");
  if (svg === null) throw new Error("No <svg>");
  return svg;
};

/** Lets `fillmorph/react` finish loading `react-dom/server` for its first element icon. */
async function settle(isReady: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !isReady(); i++) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
}

describe("the icon-input section", () => {
  it("shows the lock element's own color and size on <FillMorph>, and morphs on click", async () => {
    const lock = svgIn(button("Unlock"));
    await settle(() => lock.getAttribute("width") !== null);
    expect(lock.getAttribute("width")).toBe("56");
    expect(lock.getAttribute("height")).toBe("56");
    expect(lock.style.color).toBe("#f97316");
    expect(lock.getAttribute("viewBox")).toBe("0 0 100 100");
    const locked = lock.querySelector("path")?.getAttribute("d");
    expect(locked).toBeTruthy();

    await act(async () => button("Unlock").click());
    const unlocked = svgIn(button("Lock"));
    expect(unlocked.style.color).toBe("#10b981");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(unlocked.querySelector("path")?.getAttribute("d")).not.toBe(locked);
  });

  it("draws the ?raw markup icon at the size it's given", () => {
    const sound = svgIn(button("Mute"));
    expect(sound.getAttribute("width")).toBe("56");
    expect(sound.querySelector("path")?.getAttribute("d")).toBeTruthy();
  });

  it("shows each example's source, with ?raw visible in the markup example's imports", () => {
    const listings = [...container.querySelectorAll("pre code")].map((code) => code.textContent);
    expect(listings).toHaveLength(2);
    expect(listings[0]).toContain("<FaLock color=");
    expect(listings[1]).toMatch(/^import soundOn from "\.\/volume-low\.svg\?raw";$/m);
    expect(listings[1]).toMatch(/^import soundOff from "\.\/volume-xmark\.svg\?raw";$/m);
  });
});
