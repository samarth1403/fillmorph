import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

/** Small real icons in spec 02's contract, in different native frames. */
export const SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"/></svg>';
export const DIAMOND =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 4L44 24L24 44L4 24Z"/></svg>';
export const CIRCLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2A10 10 0 1 1 12 22A10 10 0 1 1 12 2Z"/></svg>';
/** A square with a square hole (1 hole), so morphs to and from it grow or collapse a hole. */
export const RING =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M2 2H22V22H2Z M7 7V17H17V7Z"/></svg>';
/** Not well-formed XML: a `FillmorphMarkupError`. */
export const MALFORMED = '<svg viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"></svg';
/** A stroke-only icon: a `FillmorphIncompatibleIconError`. */
export const STROKE_ONLY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black"><path d="M4 4H20V20H4Z"/></svg>';

/** One animation frame's length, in milliseconds. */
export const FRAME_MS = 1000 / 60;

/**
 * A controllable stand-in for `requestAnimationFrame`, as in `fillmorph/dom`'s own tests:
 * callbacks queue up and run only when a test calls `frame(timestamp)`.
 */
export function installFakeAnimationFrames() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    pending.delete(id);
  });
  return {
    pendingCount: () => pending.size,
    /** Runs every callback queued so far with `timestamp` (milliseconds), inside `act`. */
    frame(timestamp: number) {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(timestamp);
      });
    },
  };
}

export type FakeFrames = ReturnType<typeof installFakeAnimationFrames>;

/** Tells React this is a test environment, so `act` flushes updates without warning. */
export function enableActEnvironment(): void {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

/** A mounted React tree in a detached container, driven through `act`. */
export type Mounted = {
  container: HTMLElement;
  render: (node: ReactNode) => void;
  unmount: () => void;
};

export function mount(node: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  const render = (next: ReactNode) => {
    act(() => root.render(next));
  };
  render(node);
  return {
    container,
    render,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** The `d` of the `index`th `<path>` in `container`. */
export function pathData(container: HTMLElement, index = 0): string {
  const path = container.querySelectorAll("path")[index];
  if (path === undefined) throw new Error(`no <path> #${index} rendered`);
  return path.getAttribute("d") ?? "";
}
