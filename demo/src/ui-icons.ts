/**
 * Icon pairs the page's chrome morphs between that aren't in the 164-icon set: each folder under
 * `demo/ui-pairs/` holds exactly one pair of verbatim Font Awesome Free 6.7.2 files, vetted on its
 * own by `pnpm demo:vet` (and `ui-icons.test.ts`). Font Awesome's moon and copy icons fail against
 * too many set icons to join it, but each morphs cleanly with its partner here.
 */
const FILES = import.meta.glob<string>("../ui-pairs/*/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

function file(pair: string, name: string): string {
  const markup = FILES[`../ui-pairs/${pair}/${name}.svg`];
  if (markup === undefined) throw new Error(`No file demo/ui-pairs/${pair}/${name}.svg`);
  return markup;
}

export const COPY_ICON = file("copy", "fa-solid-copy");
export const COPIED_ICON = file("copy", "fa-solid-check");
export const SUN_ICON = file("theme", "fa-solid-sun");
export const MOON_ICON = file("theme", "fa-solid-moon");

/** Every pair folder, for the vetting test. */
export const UI_PAIRS: readonly { name: string; icons: { name: string; markup: string }[] }[] = [
  ...new Set(Object.keys(FILES).map((path) => path.split("/")[2] ?? "")),
].map((name) => ({
  name,
  icons: Object.entries(FILES)
    .filter(([path]) => path.split("/")[2] === name)
    .map(([path, markup]) => ({ name: path, markup })),
}));
