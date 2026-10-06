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
  type MathNode,
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

/**
 * The instance still contains mathjs's own `evaluate` (needed to run formulas),
 * and an expression could call it (or `parse`) from inside itself. So formulas
 * are parsed first and walked: only constants, parentheses, operators, calls to
 * the allowed pure functions, and symbols that are scope vars, allowed functions
 * or constants may appear. Everything else (assignment, indexing, objects,
 * `evaluate`, `parse`, `import`, `createUnit`, `constructor`, ...) is rejected
 * before anything runs.
 */
const ALLOWED_FUNCTIONS = new Set(["sqrt", "exp", "log", "abs", "min", "max", "round", "floor", "ceil", "mod"]);
const ALLOWED_CONSTANTS = new Set(["pi", "e"]);
const ALLOWED_OPERATORS = new Set(["+", "-", "*", "/", "^", "%", "mod"]);

type AstNode = MathNode;

function assertSafe(node: AstNode, vars: Set<string>): void {
  node.traverse((n: AstNode) => {
    switch (n.type) {
      case "ConstantNode": {
        if (typeof (n as unknown as { value: unknown }).value !== "number") throw new Error("Only numbers are allowed");
        return;
      }
      case "ParenthesisNode":
        return;
      case "OperatorNode": {
        const op = (n as unknown as { op: string }).op;
        if (!ALLOWED_OPERATORS.has(op)) throw new Error(`Operator ${op} is not allowed`);
        return;
      }
      case "FunctionNode": {
        const fn = (n as unknown as { fn: AstNode }).fn;
        const name = (fn as unknown as { name?: string }).name;
        if (fn.type !== "SymbolNode" || !name || !ALLOWED_FUNCTIONS.has(name) || vars.has(name)) {
          throw new Error(`Function ${name ?? "(expression)"} is not allowed`);
        }
        return;
      }
      case "SymbolNode": {
        const name = (n as unknown as { name: string }).name;
        if (!vars.has(name) && !ALLOWED_CONSTANTS.has(name) && !ALLOWED_FUNCTIONS.has(name)) {
          throw new Error(`Unknown name ${name}`);
        }
        return;
      }
      default:
        throw new Error(`${n.type} is not allowed in a formula`);
    }
  });
}

/** Evaluate a formula over numeric vars. Throws on anything non-numeric or unsafe. */
export function evalFormula(formula: string, scope: Record<string, number>): number {
  const node = math.parse(formula);
  assertSafe(node, new Set(Object.keys(scope)));
  const result = node.compile().evaluate({ ...scope });
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
