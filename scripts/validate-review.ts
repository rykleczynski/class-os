/**
 * Validates exam reviews: the zod contract, block checks shared with lessons, and lint warnings.
 *
 *   npm run validate:review                       every content/reviews/<slug>/review.json
 *   npm run validate:review -- <path>             one review file
 *   npm run validate:review -- --part <path>      a draft fragment {sections, practiceQuestions?, flashcards?, selfCheck?}
 *
 * Exit 0 when everything is valid (warnings allowed), 1 otherwise.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { z } from "zod";
import { reviewPartSchema } from "../lib/review/assemble";
import { reviewsRoot } from "../lib/review/paths";
import { reviewErrors, reviewLint, reviewSchema } from "../lib/review/schema";

const issues = (e: z.ZodError) => e.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

function check(file: string, part: boolean): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`FAIL ${file}\n  - invalid JSON: ${(e as Error).message}`);
    return false;
  }
  let errors: string[];
  let warnings: string[] = [];
  if (part) {
    const p = reviewPartSchema.safeParse(raw);
    errors = p.success ? reviewErrors(p.data.sections) : issues(p.error);
  } else {
    const p = reviewSchema.safeParse(raw);
    errors = p.success ? reviewErrors(p.data.sections) : issues(p.error);
    if (p.success) warnings = reviewLint(p.data);
  }
  if (errors.length) console.error(`FAIL ${file}\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  else console.log(`ok   ${file}`);
  warnings.forEach((w) => console.warn(`  warn: ${w}`));
  return errors.length === 0;
}

const args = process.argv.slice(2);
const part = args.includes("--part");
const target = args.find((a) => !a.startsWith("--"));
let files: string[];
if (target) files = [resolve(target)];
else {
  const root = reviewsRoot(join(__dirname, ".."));
  files = existsSync(root)
    ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(root, d.name, "review.json")).filter(existsSync)
    : [];
}
if (files.length === 0) console.log("no reviews found");
const failed = files.filter((f) => !check(f, part)).length;
if (files.length) console.log(`\n${files.length - failed}/${files.length} valid`);
process.exit(failed ? 1 : 0);
