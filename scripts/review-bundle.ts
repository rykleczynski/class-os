/**
 * Writes the source pack for one exam review: content/reviews/<slug>/sources/README.md (lecture index,
 * lesson digests, every exam mention in the transcripts) and sources/transcripts/<date>.txt. No network, no LLM.
 * The /exam-review command reads the pack and writes content/reviews/<slug>/review.json from it.
 *
 *   npm run review:bundle -- --course econ-134 --slug econ134-midterm-1 --title "Midterm 1" --from 2026-09-28 --to 2026-10-14
 *
 * --to defaults to today. Exit codes: 0 ok, 2 usage, 3 no lectures in the window.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { courseBySlug } from "../lib/fixtures/courses";
import { reviewsRoot, contentRoot } from "../lib/review/paths";
import { buildBundle, renderBundle } from "../lib/review/sources";

const repoRoot = join(__dirname, "..");
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const course = courseBySlug(arg("course") ?? "");
const slug = arg("slug");
const title = arg("title") ?? "Midterm";
const from = arg("from");
const to = arg("to") ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

if (!course || !slug || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || !isDate(from) || !isDate(to)) {
  console.error("usage: npm run review:bundle -- --course <course slug> --slug <review slug> --from YYYY-MM-DD [--to YYYY-MM-DD] [--title <exam title>]");
  process.exit(2);
}

const bundle = buildBundle(course, { repoRoot, contentRoot: contentRoot(repoRoot), from: from!, to });
if (bundle.lectures.length === 0) {
  console.error(`no ${course.code} lectures between ${from} and ${to}`);
  process.exit(3);
}

const out = join(reviewsRoot(repoRoot), slug, "sources");
rmSync(out, { recursive: true, force: true }); // a rebuilt pack must not keep a transcript that left the window
for (const [rel, text] of Object.entries(renderBundle(course, bundle, { slug, title, from: from!, to }))) {
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  writeFileSync(join(out, rel), text);
}
const missing = bundle.lectures.filter((l) => !l.transcript).map((l) => l.date);
console.log(
  `${slug}: ${bundle.lectures.length} lectures (${bundle.lectures.filter((l) => l.lesson).length} with lessons), ${bundle.signals.length} exam mentions` +
    (missing.length ? `, no transcript for ${missing.join(", ")}` : "") +
    ` -> ${out}`,
);
