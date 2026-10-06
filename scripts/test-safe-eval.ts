/**
 * Self-test for the slider formula evaluator. Usage: npm run test:eval
 * Normal formulas must work. Anything that can reach evaluate, parse, import,
 * createUnit or a constructor must throw.
 */
import { evalFormula } from "../lib/lesson/safe-eval";

let failed = 0;
const ok = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!pass) failed++;
};

const works = (formula: string, scope: Record<string, number>, expected: number) => {
  try {
    const v = evalFormula(formula, scope);
    ok(`works: ${formula}`, Math.abs(v - expected) < 1e-9, String(v));
  } catch (e) {
    ok(`works: ${formula}`, false, (e as Error).message);
  }
};
const blocked = (formula: string) => {
  try {
    const v = evalFormula(formula, { r: 0.07 });
    ok(`blocked: ${formula}`, false, `returned ${String(v)}`);
  } catch (e) {
    ok(`blocked: ${formula}`, true, (e as Error).message);
  }
};

works("105000 / (1 + r)^1", { r: 0.07 }, 105000 / 1.07);
works("-1000 + 500/(1+r) + 600/(1+r)^2", { r: 0.1 }, -1000 + 500 / 1.1 + 600 / 1.21);
works("max(0, round(sqrt(16))) + abs(-2) + floor(2.7) + ceil(0.1) + mod(7, 3)", {}, 4 + 2 + 2 + 1 + 1);
works("exp(log(5)) + pi - pi + e - e", {}, 5);

blocked("evaluate('1+1')");
blocked("parse('1+1').evaluate()");
blocked("import({a: 1})");
blocked("createUnit('foo')");
blocked("sqrt.constructor('return 1')()");
blocked("constructor");
blocked("r.constructor");
blocked("x = 3");
blocked("f(x) = x");
blocked("[1, 2, 3]");
blocked("{a: 1}");
blocked("'text'");
blocked("simplify('x')");

process.exit(failed ? 1 : 0);
