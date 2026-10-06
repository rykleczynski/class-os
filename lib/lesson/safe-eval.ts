import {
  create,
  evaluateDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  sqrtDependencies,
  expDependencies,
  logDependencies,
  absDependencies,
  minDependencies,
  maxDependencies,
  roundDependencies,
  floorDependencies,
  ceilDependencies,
  modDependencies,
  piDependencies,
  eDependencies,
} from "mathjs";

/**
 * A deliberately tiny mathjs instance: arithmetic and a handful of pure
 * functions. No import/createUnit/parse/simplify/derivative, no matrices,
 * no units, no string functions. Expressions run over numeric named vars only.
 */
const math = create({
  evaluateDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  sqrtDependencies,
  expDependencies,
  logDependencies,
  absDependencies,
  minDependencies,
  maxDependencies,
  roundDependencies,
  floorDependencies,
  ceilDependencies,
  modDependencies,
  piDependencies,
  eDependencies,
});

/** Evaluate a formula over numeric vars. Throws on anything non-numeric. */
export function evalFormula(formula: string, scope: Record<string, number>): number {
  const result = math.evaluate(formula, { ...scope });
  if (typeof result !== "number") throw new Error("Formula did not return a number");
  return result;
}

/** Returns an error message, or null when the formula evaluates at the var defaults. */
export function checkFormula(
  formula: string,
  vars: Array<{ name: string; default: number }>,
): string | null {
  try {
    const scope = Object.fromEntries(vars.map((v) => [v.name, v.default]));
    const out = evalFormula(formula, scope);
    if (!Number.isFinite(out)) return "formula is not finite at the default values";
    return null;
  } catch (e) {
    return `formula error: ${(e as Error).message}`;
  }
}
