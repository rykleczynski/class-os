import { z } from "zod";
import { practiceQuestionSchema, type PracticeSet, type Review } from "./schema";

/**
 * Pure pieces of practice-exam generation: the options, the difficulty targets, the prompt and the output shape.
 * No model call here (that is lib/review/generate.ts), so this is testable offline.
 */
export const generateOptionsSchema = z.object({
  /** "all" or one past exam id. */
  basedOn: z.string().min(1).max(80),
  difficulty: z.enum(["same", "harder", "easier"]),
});
export type GenerateOptions = z.infer<typeof generateOptionsSchema>;

/** What the model returns. Ids, kind, source and provenance are filled in by the app, never by the model. */
export const generatedExamOutputSchema = z.object({
  title: z.string().min(1).describe("Short, e.g. 'Practice Midterm: cement plants, fisheries and a lake cleanup'"),
  instructions: z.string().min(1),
  minutes: z.number().int().positive(),
  questions: z
    .array(
      practiceQuestionSchema.omit({ id: true }).extend({
        difficulty: z.number().int().min(1).max(5),
      }),
    )
    .min(1)
    .max(8),
});
export type GeneratedExamOutput = z.infer<typeof generatedExamOutputSchema>;

/** The past exams a generation is modeled on. */
export function baseExams(review: Review, basedOn: string): PracticeSet[] {
  return basedOn === "all" ? review.pastExams : review.pastExams.filter((e) => e.id === basedOn);
}

const shift = { same: 0, harder: 1, easier: -1 } as const;

/**
 * Difficulty per question slot, from the most recent base exam's questions in order (one real exam's shape, and
 * the closest to this year's style), shifted by the requested direction and kept in 1..5. Unrated questions count as 3.
 */
export function targetDifficulties(bases: PracticeSet[], difficulty: GenerateOptions["difficulty"]): number[] {
  const template = bases.at(-1);
  return (template?.questions ?? []).map((q) => Math.min(5, Math.max(1, (q.difficulty ?? 3) + shift[difficulty])));
}

const DIFFICULTY_SCALE =
  "1 = recall or a one-step calculation; 2 = a standard calculation; 3 = a multi-step model as worked in class; " +
  "4 = a model in an unseen setting, or an empirical design critique; 5 = a multi-step unseen setting plus interpretation.";

function examText(e: PracticeSet): string {
  return [
    `## ${e.title} (${e.minutes} min)`,
    ...e.questions.map((q, i) =>
      [
        `### Q${i + 1}: ${q.title} [difficulty ${q.difficulty ?? "unrated"}; sections ${q.sectionIds.join(", ")}; ${q.parts.reduce((s, p) => s + p.points, 0)} pts]`,
        q.setup,
        ...q.parts.map((p, j) => `(${p.label}) [${p.points} pts] ${p.prompt}\nSolution: ${q.solutions[j] ?? ""}`),
      ].join("\n"),
    ),
  ].join("\n\n");
}

/** System and user prompts for one generation. `previous` are earlier generated exams, so settings are not reused. */
export function buildGenerationPrompt(review: Review, opts: GenerateOptions, previous: PracticeSet[]): { system: string; prompt: string; targets: number[] } {
  const bases = baseExams(review, opts.basedOn);
  const targets = targetDifficulties(bases, opts.difficulty);
  const system = [
    `You write practice exams for ${review.courseCode}, ${review.exam.title}. The student will sit your exam under time, then grade themselves against your solutions, so the solutions must be complete and correct.`,
    "Rules:",
    "- Model the exam on the past exams below: the same number of questions, the same point totals per question, the same mix of theory and empirical questions, the same kinds of verbs and part structure.",
    `- Match the target difficulty for each question slot exactly, on this scale: ${DIFFICULTY_SCALE}`,
    "- Write new questions. Use new settings, new functional forms and new numbers; never copy or lightly reword a past question. The past exams show style and level, not content to reuse.",
    "- Stay inside the exam scope: only the topics in the review sections listed below, in the professor's notation. Set each question's sectionIds to the ids of the sections it tests, from that list only.",
    "- Every number in a setup or a solution must be checked with the calc tool before you write it. Prefer clean numbers. If a part asks for a graph, describe the graph precisely in words.",
    "- Each question needs one solution per part, in order, with the full algebra, plus a rubric of what earns the points.",
    "- Markdown in setups, prompts and solutions: paragraphs, '- ' lists, **bold**, *italic*, `code` only. Write products as a*b or a x b.",
    "- Instructions: closed book except the allowed notes sheet, the time limit, show work.",
  ].join("\n");
  const sections = review.sections
    .map((s) => `- ${s.id} (${s.weight} weight): ${s.title}. Key formulas: ${s.formulas.map((f) => f.expr).join("; ") || "none"}`)
    .join("\n");
  const prompt = [
    `# Exam scope\n${review.exam.scope.summary}\n\nExcluded: ${review.exam.scope.excluded.join("; ") || "nothing"}`,
    `# Review sections (valid sectionIds)\n${sections}`,
    `# Past exams to model (${bases.length})\n${bases.map(examText).join("\n\n")}`,
    `# Target\n${targets.length} questions with difficulties ${targets.join(", ")} in that order; direction: ${opts.difficulty} relative to the past exams. Time limit: ${bases.at(-1)?.minutes ?? review.practiceExam.minutes} minutes.`,
    previous.length
      ? `# Already generated (do not reuse these settings)\n${previous.flatMap((p) => p.questions.map((q) => `- ${q.title}`)).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system, prompt, targets };
}

/** Turns model output into a stored practice set: app-assigned ids and provenance. */
export function toPracticeSet(out: GeneratedExamOutput, opts: GenerateOptions, meta: { id: string; model: string; createdAt: string }): PracticeSet {
  const short = meta.id.slice(0, 8);
  return {
    id: `gen-${short}`,
    title: out.title,
    kind: "generated",
    source: `Generated ${opts.difficulty === "same" ? "at" : opts.difficulty === "harder" ? "harder than" : "easier than"} the level of ${opts.basedOn === "all" ? "the past midterms" : opts.basedOn}`,
    minutes: out.minutes,
    instructions: out.instructions,
    questions: out.questions.map((q, i) => ({ ...q, id: `gen-${short}-q${i + 1}` })),
    generated: { basedOn: [opts.basedOn], difficulty: opts.difficulty, model: meta.model, createdAt: meta.createdAt },
  };
}
