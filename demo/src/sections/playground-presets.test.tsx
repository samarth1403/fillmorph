// @vitest-environment happy-dom
import { act, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enableActEnvironment,
  type FakeFrames,
  FRAME_MS,
  installFakeAnimationFrames,
  type Mounted,
  mount,
} from "../../../src/react/test-helpers";
import { SPRING_PRESETS } from "../presets";
import { Playground } from "./playground";

let frames: FakeFrames;
let now = 0;
let tree: Mounted;

beforeEach(() => {
  enableActEnvironment();
  frames = installFakeAnimationFrames();
  now = 0;
  tree = mount(
    <StrictMode>
      <Playground />
    </StrictMode>,
  );
});

afterEach(() => {
  tree.unmount();
  vi.unstubAllGlobals();
});

function step(count = 1): void {
  for (let index = 0; index < count; index++) {
    now += FRAME_MS;
    frames.frame(now);
  }
}

function settle(): void {
  for (let guard = 0; frames.pendingCount() > 0; guard++) {
    if (guard > 2000) throw new Error("never settled");
    step();
  }
}

const stage = (): SVGPathElement | null =>
  tree.container.querySelector("#playground-panel svg[role=img] path");

function click(selector: string, text?: string): void {
  const target = [...tree.container.querySelectorAll<HTMLElement>(selector)].find(
    (element) =>
      text === undefined ||
      element.textContent === text ||
      element.getAttribute("aria-label") === text,
  );
  if (target === undefined) throw new Error(`No ${selector} ${text ?? ""}`);
  act(() => target.click());
}

const preset = (name: string) => click("fieldset button", name);
const pickIcon = (label: string) => click("#playground-panel button[aria-label]", label);

/** Every frame's path from a click on `label` until the morph settles. */
function recordMorphTo(label: string): string[] {
  pickIcon(label);
  const path: string[] = [];
  for (let guard = 0; frames.pendingCount() > 0; guard++) {
    if (guard > 2000) throw new Error("never settled");
    step();
    path.push(stage()?.getAttribute("d") ?? "");
  }
  return path;
}

const sliders = () =>
  [...tree.container.querySelectorAll<HTMLInputElement>("input[type=range]")].map(
    (input) => input.value,
  );

function remount(): void {
  tree.unmount();
  frames = installFakeAnimationFrames();
  now = 0;
  tree = mount(
    <StrictMode>
      <Playground />
    </StrictMode>,
  );
  settle();
}

/** A preset chosen on a fresh page: its slider values and the frames of one morph under it. */
function freshBehavior(name: string): { sliders: string[]; path: string[] } {
  remount();
  preset(name);
  settle();
  expect(sliders()).toEqual(declared(name));
  return { sliders: sliders(), path: recordMorphTo("Star, solid") };
}

const PRESETS = SPRING_PRESETS.map((candidate) => candidate.label);

/** The preset's own declared values, as the sliders show them: the independent source of truth. */
function declared(name: string): string[] {
  const config = SPRING_PRESETS.find((candidate) => candidate.label === name)?.config;
  if (config === undefined) throw new Error(`No preset ${name}`);
  return [config.stiffness, config.damping, config.mass].map(String);
}

/** Which preset buttons show as active. */
const active = () =>
  [...tree.container.querySelectorAll("fieldset button[aria-pressed=true]")].map(
    (button) => button.textContent,
  );

describe("playground spring presets (spec 08 §1e #5: switching must be idempotent)", () => {
  it.each(PRESETS)(
    "%s behaves exactly as when chosen fresh, after visiting every preset, each settled",
    (name) => {
      const fresh = freshBehavior(name);
      remount();
      // Every other preset first, then all three again, ending on the one under test.
      for (const other of [...PRESETS.filter((candidate) => candidate !== name), ...PRESETS]) {
        preset(other);
        settle();
      }
      preset(name);
      settle();
      expect(sliders()).toEqual(declared(name));
      expect(active()).toEqual([name]);
      expect(recordMorphTo("Star, solid")).toEqual(fresh.path);
    },
  );

  it.each(PRESETS)(
    "%s behaves exactly as when chosen fresh, after switching presets mid-morph",
    (name) => {
      const fresh = freshBehavior(name);
      remount();
      // Switch while morphs are in flight, landing on the preset under test before anything settles.
      pickIcon("Bell, solid");
      step(6);
      for (const other of PRESETS) {
        preset(other);
        step(5);
      }
      preset(name);
      pickIcon("Heart, solid");
      step(3);
      settle();
      expect(sliders()).toEqual(declared(name));
      expect(active()).toEqual([name]);
      expect(recordMorphTo("Star, solid")).toEqual(fresh.path);
    },
  );
});
