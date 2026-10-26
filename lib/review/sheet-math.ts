import katex from "katex";
import type { PrintSheet } from "./schema";

/** A print-sheet line split into Md text and `backtick` formulas, in order. */
export function splitFormulas(line: string): Array<{ text: string; math: boolean }> {
  return line
    .split(/(`[^`]+`)/)
    .filter(Boolean)
    .map((part) => (part.startsWith("`") && part.endsWith("`") ? { text: part.slice(1, -1), math: true } : { text: part, math: false }));
}

/** A formula typeset at full size: \displaystyle keeps fractions stacked at body height instead of shrunk. */
export const renderFormula = (tex: string, throwOnError = false) => katex.renderToString(`\\displaystyle ${tex}`, { throwOnError, output: "html" });

/** Formulas KaTeX cannot parse, with where they are. */
export function formulaErrors(sheet: PrintSheet): string[] {
  const out: string[] = [];
  sheet.sides.forEach((side, i) =>
    side.forEach((b, j) =>
      [...b.lines, ...b.watch].forEach((line) => {
        for (const part of splitFormulas(line)) {
          if (!part.math) continue;
          try {
            renderFormula(part.text, true);
          } catch (e) {
            out.push(`sides.${i}.${j} (${b.heading}): \`${part.text}\`: ${(e as Error).message}`);
          }
        }
      }),
    ),
  );
  return out;
}
