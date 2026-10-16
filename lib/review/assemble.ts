import { z } from "zod";
import { practiceQuestionSchema, reviewObjectSchema, reviewSectionSchema, type Review } from "./schema";

/**
 * A review is drafted in pieces, so no single write has to produce one very large JSON file:
 * content/reviews/<slug>/frame.json holds the exam facts and everything that spans topics, and
 * content/reviews/<slug>/parts/*.json each hold one or more sections with their practice questions,
 * flashcards, self-check items and notes-sheet blocks. assembleReview merges them into one review.
 */
const notesBlock = z.object({ heading: z.string().min(1), lines: z.array(z.string().min(1)).min(1) });

export const reviewPartSchema = z.object({
  sections: z.array(reviewSectionSchema).min(1),
  practiceQuestions: z.array(practiceQuestionSchema).default([]),
  flashcards: z.array(z.object({ sectionId: z.string(), front: z.string().min(1), back: z.string().min(1) })).default([]),
  selfCheck: z.array(z.object({ sectionId: z.string(), item: z.string().min(1) })).default([]),
  notesSheet: z.array(notesBlock).default([]),
});

export const reviewFrameSchema = reviewObjectSchema.omit({ sections: true, practiceExam: true, notesSheet: true, flashcards: true, selfCheck: true }).extend({
  practiceExam: z.object({
    instructions: z.string().min(1),
    minutes: z.number().int().positive(),
    /** Cross-topic questions written for the frame, added after the parts' questions. */
    questions: z.array(practiceQuestionSchema).default([]),
    /** Question ids in display order; questions not listed follow in part order. */
    order: z.array(z.string()).default([]),
    /** Question ids to leave out entirely. */
    drop: z.array(z.string()).default([]),
    /** Question ids for the timed mock exam (exam length); everything else is extra practice. */
    mock: z.array(z.string()).default([]),
  }),
  notesSheet: z.object({
    allowance: z.string().min(1),
    /** Number of sides; blocks are split across them in order, balanced by line count. */
    sides: z.number().int().min(1).max(6),
    /** Blocks that go first on side 1 (for example the cross-topic cheat lines). */
    lead: z.array(notesBlock).default([]),
  }),
});

export type ReviewPart = z.infer<typeof reviewPartSchema>;
export type ReviewFrame = z.infer<typeof reviewFrameSchema>;

/** Splits blocks into `n` consecutive runs with roughly equal line counts. */
export function balanceSides<T extends { lines: string[] }>(blocks: T[], n: number): T[][] {
  const weight = (b: T) => b.lines.length + 1; // the heading costs about a line
  const total = blocks.reduce((s, b) => s + weight(b), 0);
  const sides: T[][] = Array.from({ length: n }, () => []);
  let acc = 0;
  for (const b of blocks) {
    const side = Math.min(n - 1, Math.floor((acc + weight(b) / 2) / (total / n)));
    sides[side].push(b);
    acc += weight(b);
  }
  return sides.filter((s) => s.length > 0);
}

/** Merges a frame and its parts (in the given order) into a review. The result still needs reviewSchema validation. */
export function assembleReview(frame: ReviewFrame, parts: ReviewPart[]): Review {
  const { practiceExam: pe, notesSheet: ns, ...rest } = frame;
  const all = [...parts.flatMap((p) => p.practiceQuestions), ...pe.questions];
  const rank = new Map(pe.order.map((id, i) => [id, i]));
  const drop = new Set(pe.drop);
  const questions = all
    .filter((q) => !drop.has(q.id))
    .map((q, i) => ({ q, i }))
    .sort((a, b) => (rank.get(a.q.id) ?? pe.order.length + a.i) - (rank.get(b.q.id) ?? pe.order.length + b.i))
    .map(({ q }) => q);
  return {
    ...rest,
    sections: parts.flatMap((p) => p.sections),
    practiceExam: { instructions: pe.instructions, minutes: pe.minutes, questions, mock: pe.mock },
    notesSheet: { allowance: ns.allowance, sides: balanceSides([...ns.lead, ...parts.flatMap((p) => p.notesSheet)], ns.sides) },
    flashcards: parts.flatMap((p) => p.flashcards),
    selfCheck: parts.flatMap((p) => p.selfCheck),
  };
}
