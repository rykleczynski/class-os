/**
 * Collects everything a review is built from: the lessons and transcripts for one course inside a
 * date window, plus every line in the course's transcripts where the professor talks about exams.
 * Pure file reads, no network, no LLM. Used by scripts/review-bundle.ts.
 *
 * Never reads materials/ for a course with `materials_allowed: false`: its syllabus forbids AI use of
 * course files, so the bundle only lists that the files were left out.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Course } from "../fixtures/courses";
import { manifest } from "../fixtures/manifest";
import type { Lesson } from "../lesson/schema";

export type SourceLecture = {
  /** Local date, America/Los_Angeles. */
  date: string;
  /** Lesson slug, or null for a transcript that has no lesson yet. */
  lessonSlug: string | null;
  lesson: Lesson | null;
  transcript: string | null;
};

export type ExamSignal = { date: string; line: number; context: string[] };

export type SourceBundle = {
  lectures: SourceLecture[];
  signals: ExamSignal[];
  /** Readable course files (syllabus, slides), or null when the course opted out. */
  materials: string[] | null;
};

export const EXAM_PATTERN = /\b(mid-?terms?|mid term|final exam|the exam|exams?|syllabus|cheat sheet|sheet of paper|notes sheet|office hours|practice (exam|problems?)|problem sets?|past (mid-?terms?|exams?))\b/i;

export const laDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

/** Drops SRT indices, timestamps, Panopto bullet markers and blank lines. */
export function cleanTranscript(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*•\s*/, "").trimEnd())
    .filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !/^[\d:,.]+(\s*-->\s*[\d:,.]+)?$/.test(l.trim()))
    .join("\n");
}

const readJson = <T>(p: string): T | null => {
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
};
const readText = (p: string | null) => (p && existsSync(p) ? readFileSync(p, "utf8") : null);

/** Every lecture for the course that has a lesson or a transcript, keyed by local date (content/ wins over fixtures). */
export function courseLectures(course: Course, repoRoot: string, contentRoot: string): SourceLecture[] {
  const byDate = new Map<string, SourceLecture>();
  const fixtures = join(repoRoot, "lib", "fixtures");
  for (const e of manifest.filter((m) => m.courseCode === course.code)) {
    const lesson = readJson<Lesson>(join(fixtures, "lessons", `${e.slug}.json`));
    const transcript = readText(e.transcriptFile ? join(fixtures, "transcripts", e.transcriptFile) : null);
    if (lesson || transcript) byDate.set(laDate(e.startsAt), { date: laDate(e.startsAt), lessonSlug: e.slug, lesson, transcript });
  }
  // content/<prefix>-YYYY-MM-DD/ holds generated lessons and Panopto transcripts that have no lesson yet.
  const prefix = course.slug.replace(/-/g, "");
  if (existsSync(contentRoot)) {
    for (const d of readdirSync(contentRoot, { withFileTypes: true })) {
      const m = d.isDirectory() ? new RegExp(`^${prefix}-(\\d{4}-\\d{2}-\\d{2})$`).exec(d.name) : null;
      if (!m) continue;
      const dir = join(contentRoot, d.name);
      const meta = readJson<{ startsAt?: string; transcriptFile?: string | null }>(join(dir, "meta.json"));
      const lesson = readJson<Lesson>(join(dir, "lesson.json"));
      const transcript = readText(join(dir, meta?.transcriptFile || "transcript.txt"));
      if (!lesson && !transcript) continue;
      const date = meta?.startsAt ? laDate(meta.startsAt) : m[1];
      const prev = byDate.get(date);
      byDate.set(date, {
        date,
        lessonSlug: lesson ? d.name : (prev?.lessonSlug ?? null),
        lesson: lesson ?? prev?.lesson ?? null,
        transcript: transcript ?? prev?.transcript ?? null,
      });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Lines that mention exams, with `radius` lines of context on each side. Overlapping windows merge. */
export function examSignals(lectures: SourceLecture[], radius = 3): ExamSignal[] {
  const out: ExamSignal[] = [];
  for (const l of lectures) {
    if (!l.transcript) continue;
    const lines = cleanTranscript(l.transcript).split("\n");
    let lastEnd = -1;
    lines.forEach((line, i) => {
      if (!EXAM_PATTERN.test(line)) return;
      const start = Math.max(0, i - radius);
      const end = Math.min(lines.length, i + radius + 1);
      const prev = out.at(-1);
      if (prev && prev.date === l.date && start <= lastEnd) prev.context.push(...lines.slice(lastEnd, end));
      else out.push({ date: l.date, line: i + 1, context: lines.slice(start, end) });
      lastEnd = end;
    });
  }
  return out;
}

export function buildBundle(course: Course, opts: { repoRoot: string; contentRoot: string; from: string; to: string }): SourceBundle {
  const all = courseLectures(course, opts.repoRoot, opts.contentRoot);
  const lectures = all.filter((l) => l.date >= opts.from && l.date <= opts.to);
  // Signals come from every lecture so far: the exam is often described after its window closes.
  const signals = examSignals(all);
  let materials: string[] | null = null;
  if (course.materials_allowed !== false) {
    const dir = join(opts.repoRoot, "materials", course.slug);
    materials = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith(".")).map((f) => join("materials", course.slug, f)) : [];
  }
  return { lectures, signals, materials };
}

/** The bundle as files: README.md (index, lesson digests, exam signals) and one cleaned transcript per lecture. */
export function renderBundle(course: Course, b: SourceBundle, exam: { slug: string; title: string; from: string; to: string }): Record<string, string> {
  const files: Record<string, string> = {};
  const r: string[] = [
    `# Sources for ${course.code} ${exam.title} (${exam.slug})`,
    "",
    `Window: ${exam.from} to ${exam.to}. ${b.lectures.length} lectures. Read every transcript in full; the lesson digests are summaries, not the record.`,
    "",
    "## Lectures",
    "",
    "| Date | Lesson | Transcript |",
    "|---|---|---|",
    ...b.lectures.map((l) => `| ${l.date} | ${l.lesson ? `${l.lessonSlug}: ${l.lesson.title}` : "none yet"} | ${l.transcript ? `transcripts/${l.date}.txt (${cleanTranscript(l.transcript).length} chars)` : "missing"} |`),
    "",
    "## Course files",
    "",
    b.materials === null
      ? `None used: ${course.code} sets materials_allowed: false (its syllabus forbids AI use of course files). Do not read materials/${course.slug}/. Scope must come from what was said in lecture.`
      : b.materials.length
        ? ["Readable (syllabus first for the exam policy):", ...b.materials.map((m) => `- ${m}`)].join("\n")
        : "No files in materials/ for this course.",
    "",
    "## What was said about exams",
    "",
    b.signals.length ? "Every transcript line matching the exam pattern, with context. Lines are from the cleaned transcripts." : "Nothing found.",
    "",
    ...b.signals.flatMap((s) => [`### ${s.date}, line ${s.line}`, "", ...s.context.map((c) => `> ${c}`), ""]),
    "## Lesson digests",
    "",
  ];
  for (const l of b.lectures) {
    if (!l.lesson) continue;
    const ls = l.lesson;
    r.push(
      `### ${l.date}: ${ls.title} (${l.lessonSlug})`,
      "",
      `Hook: ${ls.hook}`,
      "",
      "Objectives:",
      ...ls.objectives.map((o) => `- ${o}`),
      "",
      "Recap:",
      ...ls.recap.map((o) => `- ${o}`),
      "",
      `Concepts: ${ls.concepts.join("; ")}`,
      "",
      "Steps:",
      ...ls.steps.flatMap((s) => [
        `- ${s.title}`,
        ...s.blocks.flatMap((blk) => {
          const t = blk as { type: string; md?: string; text?: string; q?: string; frames?: { title: string; text: string; math?: string }[] };
          if (t.type === "prose" && t.md) return [`  - ${t.md.replace(/\n+/g, " ")}`];
          if (t.type === "keyIdea" && t.text) return [`  - Key idea: ${t.text}`];
          if (t.type === "stepper" && t.frames) return t.frames.map((f) => `  - ${f.title}: ${f.text}${f.math ? ` [${f.math}]` : ""}`);
          if (t.type === "mcq" && t.q) return [`  - Check: ${t.q}`];
          return [];
        }),
      ]),
      "",
      "Quiz:",
      ...ls.quiz.map((q) => `- ${q.q} -> ${q.options[q.answer]} (${q.why})`),
      "",
    );
  }
  files["README.md"] = r.join("\n");
  for (const l of b.lectures) if (l.transcript) files[`transcripts/${l.date}.txt`] = cleanTranscript(l.transcript) + "\n";
  return files;
}
