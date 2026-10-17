import { z } from "zod";
import { blockSchema, mcqBlock } from "../lesson/schema";
import { blockIssues, longestAnswerTell } from "../lesson/checks";

/**
 * The exam review contract. One review covers one exam (a midterm or the final) for one course
 * and is built from every lesson and transcript inside the exam's scope. The content file lives in
 * the gitignored content/reviews/<slug>/review.json, is checked by scripts/validate-review.ts and
 * uploaded by scripts/review-sync.ts. Bump REVIEW_SCHEMA_VERSION on any breaking change.
 */
export const REVIEW_SCHEMA_VERSION = 1 as const;

const md = z.string().min(1).describe("Markdown subset rendered by components/Md.tsx.");
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

/** A statement about what the exam covers, with where it came from. */
const scopeEvidence = z.object({
  source: z.enum(["syllabus", "lecture", "announcement", "past-exam"]),
  /** Lecture date for source "lecture". */
  date: localDate.optional(),
  /** Close to verbatim; caption garbles fixed only for domain terms. */
  quote: z.string().min(1),
  /** What the quote tells us about the exam. */
  meaning: z.string().min(1),
});

const scopeLecture = z.object({
  date: localDate,
  title: z.string().min(1),
  /** Lesson slug when a lesson exists, so the page can link to it. */
  lessonSlug: z.string().min(1).nullable(),
  topics: z.array(z.string().min(1)).min(1),
});

const concept = z.object({ term: z.string().min(1), definition: md });

const formula = z.object({
  name: z.string().min(1),
  /** One line, shown in a monospace panel. */
  expr: z.string().min(1),
  meaning: md,
});

const workedExample = z.object({
  title: z.string().min(1),
  prompt: md,
  steps: z
    .array(z.object({ title: z.string().min(1), text: md, math: z.string().optional() }))
    .min(2),
  answer: md,
});

const profQuote = z.object({ date: localDate, quote: z.string().min(1), why: z.string().min(1) });

export const reviewSectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  /** Dates of the lectures this section draws on. Each must be one of exam.scope.lectures. */
  lectures: z.array(localDate).min(1),
  /** How likely this is to carry points, judged from class emphasis, problem sets and past exams. */
  weight: z.enum(["high", "medium", "low"]),
  weightWhy: z.string().min(1),
  summary: md,
  concepts: z.array(concept).min(1),
  formulas: z.array(formula),
  /** Visuals and interactions, the same block kit as lessons (supplyDemand, slider, compare, ...). */
  blocks: z.array(blockSchema),
  workedExamples: z.array(workedExample).min(1),
  pitfalls: z.array(md).min(1),
  quotes: z.array(profQuote),
  checks: z.array(mcqBlock).min(2),
});

const practicePart = z.object({ label: z.string().min(1), prompt: md, points: z.number().positive() });

export const practiceQuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  sectionIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1),
  /** Shared setup for the parts. */
  setup: md,
  parts: z.array(practicePart).min(1),
  /** One entry per part, in order: a full model answer. */
  solutions: z.array(md).min(1),
  /** What a grader would look for. */
  rubric: z.array(z.string().min(1)),
});

/** The review object without the cross-reference checks, so drafts (lib/review/assemble.ts) can derive from it. */
export const reviewObjectSchema = z.object({
  schema_version: z.literal(REVIEW_SCHEMA_VERSION),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  /** ISO time the review was generated, so the page can say how fresh it is. */
  generatedAt: z.iso.datetime({ offset: true }),
  exam: z.object({
    title: z.string().min(1),
    kind: z.enum(["midterm", "final", "quiz"]),
    /** Null when the date was never stated. */
    startsAt: z.iso.datetime({ offset: true }).nullable(),
    /** Format facts: length, allowed aids, cumulative or not. Only what a source states. */
    format: z.array(z.string().min(1)).min(1),
    scope: z.object({
      summary: md,
      lectures: z.array(scopeLecture).min(1),
      evidence: z.array(scopeEvidence).min(1),
      /** Topics that look in scope but were explicitly pushed past the exam. */
      excluded: z.array(z.string().min(1)),
      /** Sources that exist but were not used, and why (for example a syllabus that forbids AI use). */
      gaps: z.array(z.string().min(1)),
    }),
  }),
  /** Ordered plan from today to the exam. */
  studyPlan: z.array(z.object({ when: z.string().min(1), tasks: z.array(z.string().min(1)).min(1) })).min(1),
  /** The course's through-line: how the topics connect. */
  bigPicture: md,
  sections: z.array(reviewSectionSchema).min(1),
  /** Cross-topic links an exam question could combine. */
  connections: z.array(md),
  practiceExam: z.object({
    instructions: md,
    minutes: z.number().int().positive(),
    questions: z.array(practiceQuestionSchema).min(3),
    /** Question ids that make up the timed mock exam, in order. The rest are extra practice by topic. Empty: all of them. */
    mock: z.array(z.string()).default([]),
  }),
  /** A draft for the allowed notes sheet. Each column is one side. */
  notesSheet: z.object({
    allowance: z.string().min(1),
    sides: z
      .array(z.array(z.object({ heading: z.string().min(1), lines: z.array(z.string().min(1)).min(1) })).min(1))
      .min(1),
  }),
  flashcards: z.array(z.object({ sectionId: z.string().min(1), front: z.string().min(1), back: z.string().min(1) })).min(10),
  /** "I can ..." statements, checked off on the page. */
  selfCheck: z.array(z.object({ sectionId: z.string().min(1), item: z.string().min(1) })).min(5),
});

export const reviewSchema = reviewObjectSchema.superRefine((r, ctx) => {
  const sectionIds = new Set(r.sections.map((s) => s.id));
  const lectureDates = new Set(r.exam.scope.lectures.map((l) => l.date));
  if (sectionIds.size !== r.sections.length) ctx.addIssue({ code: "custom", message: "section ids must be unique", path: ["sections"] });
  r.sections.forEach((s, i) =>
    s.lectures.forEach((d, j) => {
      if (!lectureDates.has(d)) ctx.addIssue({ code: "custom", message: `lecture ${d} is not in exam.scope.lectures`, path: ["sections", i, "lectures", j] });
    }),
  );
  const qIds = new Set<string>();
  r.practiceExam.questions.forEach((q, i) => {
    if (qIds.has(q.id)) ctx.addIssue({ code: "custom", message: "question ids must be unique", path: ["practiceExam", "questions", i, "id"] });
    qIds.add(q.id);
    if (q.solutions.length !== q.parts.length)
      ctx.addIssue({ code: "custom", message: "one solution per part", path: ["practiceExam", "questions", i, "solutions"] });
    // Saved answers and scores are keyed by part label, so labels must be unique within a question.
    const labels = q.parts.map((p) => partLabel(p.label));
    if (new Set(labels).size !== labels.length)
      ctx.addIssue({ code: "custom", message: "part labels must be unique", path: ["practiceExam", "questions", i, "parts"] });
    q.sectionIds.forEach((id, j) => {
      if (!sectionIds.has(id)) ctx.addIssue({ code: "custom", message: `unknown section ${id}`, path: ["practiceExam", "questions", i, "sectionIds", j] });
    });
  });
  const mockIds = new Set<string>();
  r.practiceExam.mock.forEach((id, i) => {
    if (!qIds.has(id)) ctx.addIssue({ code: "custom", message: `unknown question ${id}`, path: ["practiceExam", "mock", i] });
    if (mockIds.has(id)) ctx.addIssue({ code: "custom", message: `duplicate mock question ${id}`, path: ["practiceExam", "mock", i] });
    mockIds.add(id);
  });
  const refs: Array<[string, (string | number)[]]> = [
    ...r.flashcards.map((f, i): [string, (string | number)[]] => [f.sectionId, ["flashcards", i, "sectionId"]]),
    ...r.selfCheck.map((c, i): [string, (string | number)[]] => [c.sectionId, ["selfCheck", i, "sectionId"]]),
  ];
  for (const [id, path] of refs) if (!sectionIds.has(id)) ctx.addIssue({ code: "custom", message: `unknown section ${id}`, path });
});

/** A part label without wrapping parentheses: drafts write "a" or "(a)". */
export const partLabel = (label: string) => label.replace(/^\((.*)\)$/, "$1");

export type Review = z.infer<typeof reviewSchema>;
export type ReviewSection = z.infer<typeof reviewSectionSchema>;
export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;

/** Errors the schema cannot express: block formulas and curve references, MCQ answer indices. */
export function reviewErrors(sections: ReviewSection[]): string[] {
  return sections.flatMap((s) => [
    ...s.blocks.flatMap((b, i) => blockIssues(b).map((m) => `${s.id} block ${i} (${b.type}): ${m}`)),
    ...s.checks.flatMap((c, i) => blockIssues(c).map((m) => `${s.id} check ${i}: ${m}`)),
  ]);
}

/** Warnings: answer-length tells, uncovered high-weight sections, in-scope lectures no section uses. */
export function reviewLint(r: Review): string[] {
  const out: string[] = [];
  const mcqs = r.sections.flatMap((s) => s.checks);
  const tell = longestAnswerTell(mcqs);
  if (tell) out.push(tell);
  if (mcqs.length >= 6 && new Set(mcqs.map((c) => c.answer)).size === 1) out.push("every check has the same answer index");
  const covered = new Set(r.practiceExam.questions.flatMap((q) => q.sectionIds));
  for (const s of r.sections) if (s.weight === "high" && !covered.has(s.id)) out.push(`${s.id}: high-weight section has no practice question`);
  const lectured = new Set(r.sections.flatMap((s) => s.lectures));
  for (const l of r.exam.scope.lectures) if (!lectured.has(l.date)) out.push(`lecture ${l.date} is in scope but no section uses it`);
  return out;
}
