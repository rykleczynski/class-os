/**
 * Validates exam reviews: the zod contract, block checks shared with lessons, and lint warnings.
 *
 *   npm run validate:review                       every content/reviews/<slug>/review.json
 *   npm run validate:review -- <path>             one review file
 *   npm run validate:review -- --part <path>      a draft fragment {sections, practiceQuestions?, flashcards?, selfCheck?}
 *   npm run validate:review -- --past <path> --sections a,b,c   a past exam (past/*.json) against the review's section ids
 *   npm run validate:review -- --notes <path>     the notes builder (notes-builder.json)
 *   npm run validate:review -- --print <path>     the print sheet (print-sheet.json)
 *
 * Exit 0 when everything is valid (warnings allowed), 1 otherwise.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { z } from "zod";
import { reviewPartSchema } from "../lib/review/assemble";
import { reviewsRoot } from "../lib/review/paths";
import { notesBuilderSchema, practiceSetSchema, printSheetSchema, questionIssues, reviewErrors, reviewLint, reviewSchema } from "../lib/review/schema";

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
  } else if (past) {
    const p = practiceSetSchema.safeParse(raw);
    errors = p.success ? questionIssues(p.data.questions, sectionIds).map((i) => `questions.${i.path.join(".")}: ${i.message}`) : issues(p.error);
  } else if (notes) {
    const p = notesBuilderSchema.safeParse(raw);
    errors = p.success ? [] : issues(p.error);
  } else if (print) {
    const p = printSheetSchema.safeParse(raw);
    errors = p.success ? [] : issues(p.error);
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
const past = args.includes("--past");
const notes = args.includes("--notes");
const print = args.includes("--print");
// --past checks question section ids against the review's sections, given as --sections id1,id2,...
const sectionsIdx = args.indexOf("--sections");
const sectionIds = new Set(sectionsIdx >= 0 ? (args[sectionsIdx + 1] ?? "").split(",").filter(Boolean) : []);
if (past && sectionIds.size === 0) {
  console.error("--past needs --sections <comma-separated section ids>");
  process.exit(2);
}
const target = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--sections");
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
