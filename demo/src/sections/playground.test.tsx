// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import lucideHeart from "../assets/lucide-heart.svg?raw";
import starSolid from "../../icons/fa-solid-star.svg?raw";
import { Playground } from "./playground";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let unmount: () => void;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Playground />));
  unmount = () => act(() => root.unmount());
  const customTab = [...container.querySelectorAll<HTMLButtonElement>("[role=tab]")].find(
    (tab) => tab.textContent === "Your own SVGs",
  );
  await act(async () => customTab?.click());
});

afterEach(() => {
  unmount();
  container.remove();
});

/** Types into a React-controlled textarea the way a browser does: native value, then `input`. */
async function paste(id: string, text: string): Promise<void> {
  const field = container.querySelector<HTMLTextAreaElement>(`#${id}`);
  if (field === null) throw new Error(`No #${id}`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const code = () => container.querySelector("pre code")?.textContent ?? "";
const morphButton = () =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.startsWith("Morph to"),
  );

describe("the paste-your-own-SVG tool", () => {
  it("opens on a clean default pair, with a React component for it", () => {
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(code()).toContain("<FillMorph");
    expect(code()).toContain("springConfig={{ stiffness: 120, damping: 22, mass: 1 }}");
    expect(morphButton()?.disabled).toBe(false);
  });

  it("shows a clear inline error for markup that isn't SVG, and disables the morph", async () => {
    await paste("paste-from", '<svg><path d="M0 0');
    expect(container.querySelector("#paste-from-error")?.textContent).toMatch(
      /^Not valid SVG markup: /,
    );
    expect(morphButton()?.disabled).toBe(true);
  });

  it("names a stroke icon as outside the contract, rather than morphing it badly", async () => {
    await paste("paste-to", lucideHeart);
    expect(container.querySelector("#paste-to-error")?.textContent).toMatch(
      /^Outside fillmorph's icon contract: /,
    );
  });

  it("puts a valid paste straight into the component, and clears the error", async () => {
    await paste("paste-from", '<svg><path d="M0 0');
    await paste("paste-from", starSolid);
    expect(container.querySelector("#paste-from-error")).toBeNull();
    expect(code()).toContain(starSolid.trim().slice(0, 60));
    expect(morphButton()?.disabled).toBe(false);
  });

  it("updates the component's spring live as a slider moves", async () => {
    const stiffness = container.querySelector<HTMLInputElement>("input[type=range]");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(stiffness, "420");
      stiffness?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(code()).toContain("stiffness: 420,");
  });
});
