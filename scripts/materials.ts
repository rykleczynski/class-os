/**
 * Zero-token pickup of course slides. Scans Downloads for PDF/PPTX/DOCX files whose names match a
 * course's `materials_patterns` and copies (never moves) them into materials/<course slug>/, which is
 * gitignored. No LLM, no network. Always exits 0.
 *
 *   npm run materials
 *   CLASSOS_DOWNLOADS=/some/dir   scan this directory instead of ~/Downloads
 *   CLASSOS_MATERIALS_DIR=/dir    file into this directory instead of ./materials (tests)
 *   CLASSOS_CONTENT_DIR=/dir      write Panopto transcripts under this directory instead of ./content (tests)
 *
 * Also converts Panopto (BruinCast) caption files for courses with transcript_source "panopto" into
 * content/<slug>/transcript.txt. That is lecture text, not slides, so the materials_allowed opt-out does not apply.
 *
 * A course with `materials_allowed: false` is never copied, even if a pattern matches.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { courses as realCourses, type Course } from "../lib/fixtures/courses";
import { captionTarget, looksLikeCaptions, srtToText } from "./panopto";

const EXTENSIONS = new Set([".pdf", ".pptx", ".docx"]);

type MaterialsCourse = Pick<Course, "slug" | "code" | "materials_allowed" | "materials_patterns">;

const hashOf = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Content hashes of every file already filed for a course, so renamed duplicates ("Foo (1).pdf") are skipped too. */
function existingHashes(dir: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      if (statSync(p).isFile()) out.add(hashOf(p));
    } catch {
      /* unreadable file: ignore */
    }
  }
  return out;
}

export type Filed = { course: string; file: string };

/** Copies matching files. Returns the files newly filed. Never throws on a missing or unreadable directory. */
export function fileMaterials(downloads: string, materialsRoot: string, courseList: MaterialsCourse[] = realCourses): Filed[] {
  let names: string[];
  try {
    names = readdirSync(downloads);
  } catch {
    return []; // no Downloads folder: nothing to do
  }
  const filed: Filed[] = [];
  const seen = new Map<string, Set<string>>();
  // Shortest name first, so "Foo.pdf" is kept over its browser duplicate "Foo (1).pdf".
  for (const name of names.sort((a, b) => a.length - b.length || a.localeCompare(b))) {
    if (name.startsWith(".") || !EXTENSIONS.has(extname(name).toLowerCase())) continue;
    const src = join(downloads, name);
    let size: number;
    try {
      const st = statSync(src);
      if (!st.isFile()) continue;
      size = st.size;
    } catch {
      continue;
    }
    for (const c of courseList) {
      if (c.materials_allowed === false) continue; // opted out: never copy, whatever the patterns say
      if (!c.materials_patterns?.some((re) => new RegExp(re, "i").test(name))) continue;
      const dir = join(materialsRoot, c.slug);
      const dest = join(dir, name);
      try {
        if (!seen.has(c.slug)) seen.set(c.slug, existingHashes(dir));
        const hashes = seen.get(c.slug)!;
        const hash = hashOf(src);
        if (hashes.has(hash)) continue; // same bytes already filed (under this name or another)
        if (existsSync(dest) && statSync(dest).size === size && hashOf(dest) === hash) continue;
        mkdirSync(dir, { recursive: true });
        copyFileSync(src, dest);
        hashes.add(hash);
        filed.push({ course: c.slug, file: name });
      } catch (err) {
        console.error(`materials: could not copy ${name}: ${(err as Error).message}`);
      }
    }
  }
  return filed;
}

/**
 * Panopto caption files in Downloads become content/<slug>/transcript.txt (plain text, no indices or timestamps).
 * Skips a slug whose transcript.txt already exists. Genuine caption text, not model output, so sync stores it as is.
 */
export function fileCaptions(downloads: string, contentRoot: string, courseList: Pick<Course, "code" | "transcript_source">[] = realCourses): string[] {
  let names: string[];
  try {
    names = readdirSync(downloads);
  } catch {
    return [];
  }
  const done: string[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    if (/^GenerateSRT/i.test(name) && !captionTarget(name, courseList)) {
      console.error(`materials: ${name} has no session in its name; rename it to econ134-YYYY-MM-DD.srt to file it`);
      continue;
    }
    const t = captionTarget(name, courseList);
    if (!t) continue;
    try {
      const outDir = join(contentRoot, t.slug);
      const out = join(outDir, "transcript.txt");
      if (existsSync(out)) continue;
      const raw = readFileSync(join(downloads, name), "utf8");
      if (!looksLikeCaptions(raw)) {
        console.error(`materials: ${name} does not look like SRT captions, skipped`);
        continue;
      }
      const text = srtToText(raw);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(out, text);
      if (t.sessionId) writeFileSync(join(outDir, "panopto.json"), JSON.stringify({ sessionId: t.sessionId }) + "\n");
      done.push(t.slug);
    } catch (err) {
      console.error(`materials: could not file ${name}: ${(err as Error).message}`);
    }
  }
  return done;
}

function main() {
  const downloads = process.env.CLASSOS_DOWNLOADS || join(homedir(), "Downloads");
  const root = process.env.CLASSOS_MATERIALS_DIR || join(__dirname, "..", "materials");
  for (const f of fileMaterials(downloads, root)) console.log(`materials: ${f.course}/${f.file}`);
  const content = process.env.CLASSOS_CONTENT_DIR || join(__dirname, "..", "content");
  for (const slug of fileCaptions(downloads, content)) console.log(`materials: transcript ${slug}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`materials: ${(err as Error).message}`);
  }
  process.exit(0);
}
