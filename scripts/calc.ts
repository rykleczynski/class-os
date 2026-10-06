/**
 * Evaluates arithmetic expressions with the same sandboxed evaluator the lessons use
 * (lib/lesson/safe-eval.ts: numbers and a fixed set of math functions only, no I/O).
 * The generator gets this instead of unrestricted `node -e`.
 *
 *   npm run calc -- "60 - 30" "0.5 * 40^2"
 *
 * Prints `<expression> = <value>` per argument. Exits 1 if any expression is rejected.
 */
import { evalFormula } from "../lib/lesson/safe-eval";

const exprs = process.argv.slice(2);
if (!exprs.length) {
  console.error('usage: calc "<expression>" ["<expression>" ...]');
  process.exit(2);
}
let failed = 0;
for (const e of exprs) {
  try {
    console.log(`${e} = ${evalFormula(e, {})}`);
  } catch (err) {
    console.log(`${e} = ERROR (${(err as Error).message.split("\n")[0]})`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
