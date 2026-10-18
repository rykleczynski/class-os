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
  /**
   * 1 (direct recall or a one-step calculation) to 5 (a multi-step model in an unseen setting plus interpretation).
   * Rated for past-exam questions so generated exams can match their difficulty.
   */
  difficulty: z.number().int().min(1).max(5).optional(),
});

/** A whole exam to sit: a past midterm transcribed from the course site, or one generated from the past ones. */
export const practiceSetSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  title: z.string().min(1),
  kind: z.enum(["past", "generated"]),
  /** Where it came from, e.g. "Fall 2024 Midterm 1 and its posted solutions". */
  source: z.string().min(1),
  minutes: z.number().int().positive(),
  instructions: md,
  questions: z.array(practiceQuestionSchema).min(1),
  /** Set on generated exams. */
  generated: z
    .object({
      basedOn: z.array(z.string()).min(1),
      difficulty: z.enum(["same", "harder", "easier"]),
      model: z.string().min(1),
      createdAt: z.iso.datetime({ offset: true }),
    })
    .optional(),
});

/**
 * Direction for a handwritten notes sheet, grouped by lecture: what to write, how important each line is and why,
 * and how much room each lecture deserves. The page turns it into a checklist ticked off while writing.
 */
export const notesBuilderSchema = z.object({
  /** The rule as stated, e.g. "One sheet of paper, both sides." */
  allowance: z.string().min(1),
  sides: z.number().int().min(1).max(6),
  /** How to lay the sheet out by hand: order, what goes on which side, writing small without losing legibility. */
  layout: z.array(md).min(1),
  lectures: z
    .array(
      z.object({
        date: localDate,
        title: z.string().min(1),
        /** Room to give it, e.g. "About a third of side 1: this is the core model." */
        space: z.string().min(1),
        items: z
          .array(
            z.object({
              id: z.string().regex(/^[a-z0-9-]+$/),
              kind: z.enum(["formula", "definition", "result", "method", "example", "warning"]),
              /** One terse line as Ryan would write it on the sheet. */
              text: z.string().min(1).max(220),
              priority: z.enum(["must", "should", "nice"]),
              /** Why it earns space: tested on a past midterm, needed for a standard calculation, easy to misremember. */
              why: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

/** Per-question checks shared by the mock, past exams and generated exams. Returns issues with paths relative to `questions`. */
export function questionIssues(questions: PracticeQuestion[], sectionIds: Set<string>): Array<{ message: string; path: (string | number)[] }> {
  const out: Array<{ message: string; path: (string | number)[] }> = [];
  questions.forEach((q, i) => {
    if (q.solutions.length !== q.parts.length) out.push({ message: "one solution per part", path: [i, "solutions"] });
    // Saved answers and scores are keyed by part label, so labels must be unique within a question.
    const labels = q.parts.map((p) => partLabel(p.label));
    if (new Set(labels).size !== labels.length) out.push({ message: "part labels must be unique", path: [i, "parts"] });
    q.sectionIds.forEach((id, j) => {
      if (!sectionIds.has(id)) out.push({ message: `unknown section ${id}`, path: [i, "sectionIds", j] });
    });
  });
  return out;
}

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
  /** Past exams transcribed from the course site, oldest first. Generated exams live in their own store. */
  pastExams: z.array(practiceSetSchema).default([]),
  /** Candidate notes-sheet lines by lecture, for the builder tab. Absent: the page shows notesSheet only. */
  notesBuilder: notesBuilderSchema.optional(),
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
  // Question ids key saved answers, so they must be unique across the mock pool and every past exam.
  const qIds = new Set<string>();
  const sets: Array<[PracticeQuestion[], (string | number)[]]> = [
    [r.practiceExam.questions, ["practiceExam", "questions"]],
    ...r.pastExams.map((e, k): [PracticeQuestion[], (string | number)[]] => [e.questions, ["pastExams", k, "questions"]]),
  ];
  for (const [questions, base] of sets) {
    questions.forEach((q, i) => {
      if (qIds.has(q.id)) ctx.addIssue({ code: "custom", message: "question ids must be unique", path: [...base, i, "id"] });
      qIds.add(q.id);
    });
    for (const issue of questionIssues(questions, sectionIds)) ctx.addIssue({ code: "custom", message: issue.message, path: [...base, ...issue.path] });
  }
  const mockPool = new Set(r.practiceExam.questions.map((q) => q.id));
  const examIds = new Set<string>(["mock"]); // the picker's id for the lecture-built mock
  r.pastExams.forEach((e, k) => {
    if (examIds.has(e.id)) ctx.addIssue({ code: "custom", message: e.id === "mock" ? "\"mock\" is reserved for the lecture-built mock" : "past exam ids must be unique", path: ["pastExams", k, "id"] });
    examIds.add(e.id);
    if (e.kind !== "past") ctx.addIssue({ code: "custom", message: "pastExams holds kind \"past\" only", path: ["pastExams", k, "kind"] });
  });
  const mockIds = new Set<string>();
  r.practiceExam.mock.forEach((id, i) => {
    if (!mockPool.has(id)) ctx.addIssue({ code: "custom", message: `unknown question ${id}`, path: ["practiceExam", "mock", i] });
    if (mockIds.has(id)) ctx.addIssue({ code: "custom", message: `duplicate mock question ${id}`, path: ["practiceExam", "mock", i] });
    mockIds.add(id);
  });
  if (r.notesBuilder) {
    const itemIds = new Set<string>();
    r.notesBuilder.lectures.forEach((l, i) => {
      if (!lectureDates.has(l.date)) ctx.addIssue({ code: "custom", message: `lecture ${l.date} is not in exam.scope.lectures`, path: ["notesBuilder", "lectures", i, "date"] });
      l.items.forEach((it, j) => {
        if (itemIds.has(it.id)) ctx.addIssue({ code: "custom", message: `duplicate notes item ${it.id}`, path: ["notesBuilder", "lectures", i, "items", j, "id"] });
        itemIds.add(it.id);
      });
    });
  }
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
export type PracticeSet = z.infer<typeof practiceSetSchema>;
export type NotesBuilder = z.infer<typeof notesBuilderSchema>;

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
