import type { Block, McqBlock } from "./schema";
import { checkFormula } from "./safe-eval";

/** Problems with one schema-valid block that zod cannot see: formulas, curve references, answer indices. */
export function blockIssues(b: Block): string[] {
  const out: string[] = [];
  if (b.type === "mcq" && b.answer >= b.options.length) out.push("answer index out of range");
  if (b.type === "slider") {
    const msg = checkFormula(b.formula, b.vars);
    if (msg) out.push(msg);
    if (b.plot && !b.vars.some((v) => v.name === b.plot!.x)) out.push("plot.x is not a var");
  }
  if (b.type === "supplyDemand") {
    const labels = new Set([...b.curves.map((c) => c.label), ...(b.shifts ?? []).map((s) => s.label)]);
    for (const s of b.shifts ?? []) if (!b.curves.some((c) => c.label === s.of)) out.push(`shift of unknown curve ${s.of}`);
    for (const a of b.areas ?? []) for (const l of a.curves) if (!labels.has(l)) out.push(`area references unknown curve ${l}`);
  }
  return out;
}

/** Answer-length tell: a warning when the correct option is strictly the longest in more than half the MCQs. */
export function longestAnswerTell(mcqs: McqBlock[]): string | null {
  const longest = mcqs.filter((q) => {
    const lens = q.options.map((o) => o.length);
    const a = lens[q.answer];
    return lens.filter((l) => l === a).length === 1 && a === Math.max(...lens);
  }).length;
  return mcqs.length && longest > mcqs.length / 2
    ? `correct option is strictly the longest in ${longest}/${mcqs.length} MCQs; rebalance option lengths`
    : null;
}
