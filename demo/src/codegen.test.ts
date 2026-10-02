import ts from "typescript";
import { describe, expect, it } from "vitest";
import heartOutline from "../icons/fa-regular-heart.svg?raw";
import heartSolid from "../icons/fa-solid-heart.svg?raw";
import { generateReactComponent, generateVanillaScript, templateLiteralBody } from "./codegen";
import generatedExample from "./snippets/generated-example.tsx?raw";
import generatedVanillaExample from "./snippets/generated-example-vanilla.ts?raw";

/** The playground's default spring (Smooth), which the committed examples were generated with. */
const SMOOTH = { stiffness: 120, damping: 22, mass: 1 };

function syntaxErrors(source: string, fileName = "MorphingIcon.tsx"): string[] {
  const output = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    fileName,
  });
  return (output.diagnostics ?? []).map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );
}

describe("templateLiteralBody", () => {
  it("round-trips markup with backticks, backslashes and ${ through a template literal", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal "${" is exactly what's being escaped.
    const tricky = '<svg><!-- `x` \\ ${y} $z --><path d="M0 0Z"/></svg>';
    const back = new Function(`return \`${templateLiteralBody(tricky)}\`;`)();
    expect(back).toBe(tricky);
  });
});

describe("generateReactComponent", () => {
  it("matches the type-checked example exactly for the playground's default pair", () => {
    expect(generateReactComponent(heartOutline, heartSolid, SMOOTH)).toBe(generatedExample);
  });

  it("emits an arrow function component, the project's component style (spec 08 §1h #2)", () => {
    const code = generateReactComponent(heartOutline, heartSolid, SMOOTH);
    expect(code).toContain("export const MorphingIcon = () => {");
    expect(code).not.toMatch(/\bfunction\s+[A-Z]|\bclass\s+\w+\s+extends/);
  });

  it("fills in the current spring", () => {
    const code = generateReactComponent(heartOutline, heartSolid, {
      stiffness: 420,
      damping: 31,
      mass: 1.7,
    });
    expect(code).toContain("springConfig={{ stiffness: 420, damping: 31, mass: 1.7 }}");
  });

  it("stays valid TSX whatever the pasted markup contains", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal "${" is exactly what's being escaped.
    const tricky = '<svg viewBox="0 0 10 10"><!-- `${evil}` \\ --><path d="M0 0H10V10Z"/></svg>';
    expect(
      syntaxErrors(
        generateReactComponent(tricky, tricky, { stiffness: 160, damping: 12, mass: 1 }),
      ),
    ).toEqual([]);
  });
});

describe("generateVanillaScript", () => {
  it("matches the type-checked example exactly for the playground's default pair", () => {
    expect(generateVanillaScript(heartOutline, heartSolid, SMOOTH)).toBe(generatedVanillaExample);
  });

  it("fills in the current spring, on fillmorph/dom's driver", () => {
    const code = generateVanillaScript(heartOutline, heartSolid, {
      stiffness: 420,
      damping: 31,
      mass: 1.7,
    });
    expect(code).toContain(
      "createMorphDriver(from, from, { stiffness: 420, damping: 31, mass: 1.7 })",
    );
    expect(code).toContain('from "fillmorph/dom"');
  });

  it("stays valid TypeScript whatever the pasted markup contains", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal "${" is exactly what's being escaped.
    const tricky = '<svg viewBox="0 0 10 10"><!-- `${evil}` \\ --><path d="M0 0H10V10Z"/></svg>';
    expect(syntaxErrors(generateVanillaScript(tricky, tricky, SMOOTH), "morph.ts")).toEqual([]);
  });
});
