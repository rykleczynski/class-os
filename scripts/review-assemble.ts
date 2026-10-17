/**
 * Builds content/reviews/<slug>/review.json from frame.json and parts/*.json (merged in file-name order),
 * then validates it. The review is written only when it passes the schema and the block checks.
 *
 *   npm run review:assemble -- <slug>
 *
 * Exit codes: 0 written (warnings allowed), 1 invalid input or result, 2 usage.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { assembleReview, frameIssues, reviewFrameSchema, reviewPartSchema } from "../lib/review/assemble";
import { reviewsRoot } from "../lib/review/paths";
import { reviewErrors, reviewLint, reviewSchema } from "../lib/review/schema";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
  console.error("usage: npm run review:assemble -- <slug>");
  process.exit(2);
}
const dir = join(reviewsRoot(join(__dirname, "..")), slug);
const partsDir = join(dir, "parts");

function load<S extends z.ZodType>(file: string, schema: S): z.output<S> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`FAIL ${file}: ${(e as Error).message}`);
    process.exit(1);
  }
  const p = schema.safeParse(raw);
  if (!p.success) {
    console.error(`FAIL ${file}`);
    for (const i of p.error.issues.slice(0, 20)) console.error(`  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    process.exit(1);
  }
  return p.data;
}

if (!existsSync(join(dir, "frame.json")) || !existsSync(partsDir)) {
  console.error(`need ${join(dir, "frame.json")} and ${partsDir}/*.json`);
  process.exit(2);
}
const frame = load(join(dir, "frame.json"), reviewFrameSchema);
if (frame.slug !== slug) {
  console.error(`frame.json slug ${frame.slug} does not match ${slug}`);
  process.exit(1);
}
const partFiles = readdirSync(partsDir).filter((f) => f.endsWith(".json")).sort();
const parts = partFiles.map((f) => load(join(partsDir, f), reviewPartSchema));

const refErrors = frameIssues(frame, parts);
if (refErrors.length) {
  console.error(`FAIL ${join(dir, "frame.json")}`);
  refErrors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
const result = reviewSchema.safeParse(assembleReview(frame, parts));
const errors = result.success ? reviewErrors(result.data.sections) : result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
if (!result.success || errors.length) {
  console.error(`FAIL assembled ${slug}`);
  errors.slice(0, 30).forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
const review = result.data;
writeFileSync(join(dir, "review.json"), JSON.stringify(review, null, 2) + "\n");
reviewLint(review).forEach((w) => console.warn(`  warn: ${w}`));
console.log(
  `${slug}: ${review.sections.length} sections from ${partFiles.length} parts, ${review.practiceExam.questions.length} practice questions, ` +
    `${review.flashcards.length} flashcards, ${review.selfCheck.length} self-checks, ${review.notesSheet.sides.length} notes sides -> ${join(dir, "review.json")}`,
);
