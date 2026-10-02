/**
 * Minimal typings for the few Node built-ins the harness CLI and fixture loader use. The repo has
 * no `@types/node`, and adding a dev dependency just for these signatures wasn't decided on, so
 * each is declared here as a strict subset of Node's real API. Harness-only: `src/` never sees it.
 */

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(path: string, options: { recursive: true }): string | undefined;
  export function readdirSync(path: string): string[];
}

declare const process: {
  readonly argv: readonly string[];
  exitCode: number | undefined;
};

declare const console: {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
};

interface ImportMeta {
  /** Directory of the current module file (Node ≥ 20.11, and Vitest). */
  readonly dirname: string;
}
