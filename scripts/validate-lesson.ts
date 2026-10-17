import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  lessonSchema,
  stepHasVisualOrInteraction,
  stepProseWords,
} from "../lib/lesson/schema";
import { blockIssues, longestAnswerTell } from "../lib/lesson/checks";

const MAX_PROSE_ERROR = 150;
const MAX_PROSE_WARN = 120;

function collect(target: string): string[] {
  const p = resolve(target);
  if (statSync(p).isDirectory()) {
    return readdirSync(p)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(p, f));
  }
  return [p];
}

const arg = process.argv[2] ?? join(__dirname, "..", "lib", "fixtures", "lessons");
const files = collect(arg);
let failed = 0;

for (const file of files) {
  const errors: string[] = [];
  const warnings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`FAIL ${file}\n  invalid JSON: ${(e as Error).message}`);
    failed++;
    continue;
  }
  const parsed = lessonSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  } else {
    const lesson = parsed.data;
    const ids = new Set<string>();
    for (const step of lesson.steps) {
      if (ids.has(step.id)) errors.push(`duplicate step id ${step.id}`);
      ids.add(step.id);
      const words = stepProseWords(step);
      if (words > MAX_PROSE_ERROR) errors.push(`step ${step.id}: ${words} prose words (max ${MAX_PROSE_ERROR})`);
      else if (words > MAX_PROSE_WARN) warnings.push(`step ${step.id}: ${words} prose words (target <= ${MAX_PROSE_WARN})`);
      if (!stepHasVisualOrInteraction(step)) errors.push(`step ${step.id}: no visual or interactive block`);
      step.blocks.forEach((b, i) => {
        for (const msg of blockIssues(b)) errors.push(`step ${step.id} block ${i} (${b.type}): ${msg}`);
      });
    }
    lesson.quiz.forEach((q, i) => {
      if (q.answer >= q.options.length) errors.push(`quiz ${i}: answer index out of range`);
    });
    const mcqs = [...lesson.steps.flatMap((s) => s.blocks.filter((b) => b.type === "mcq")), ...lesson.quiz];
    const tell = longestAnswerTell(mcqs);
    if (tell) warnings.push(tell);
    if (!lesson.steps.some((s) => s.blocks.some((b) => b.type === "inTheNews")) && lesson.steps.length >= 5) {
      warnings.push("no inTheNews block");
    }
  }
  if (errors.length) {
    failed++;
    console.error(`FAIL ${file}`);
    errors.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log(`ok   ${file}`);
  }
  warnings.forEach((w) => console.warn(`  warn: ${w}`));
}

console.log(`\n${files.length - failed}/${files.length} lessons valid`);
process.exit(failed ? 1 : 0);
