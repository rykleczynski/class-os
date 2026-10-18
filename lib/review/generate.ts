import { randomUUID } from "node:crypto";
import { generateText, isStepCount, Output, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { evalFormula } from "../lesson/safe-eval";
import { buildGenerationPrompt, generatedExamOutputSchema, toPracticeSet, type GenerateOptions } from "./generation-prompt";
import { practiceSetSchema, questionIssues, type PracticeSet, type Review } from "./schema";

/** Through the Vercel AI Gateway (OIDC on Vercel, AI_GATEWAY_API_KEY locally). */
export const GENERATION_MODEL = "anthropic/claude-opus-5.5";

/** Arithmetic for checking numbers, through the same restricted evaluator the lesson sliders use. No eval. */
const calc = tool({
  description: "Evaluate an arithmetic expression to check a number. Operators + - * / ^ ( ) and sqrt, exp, log, abs, min, max, round, floor, ceil.",
  inputSchema: z.object({
    expression: z.string().max(500).describe("e.g. 0.5 * 20 * (60 - 40) or (a - b) / c"),
    vars: z.record(z.string(), z.number()).optional().describe("Named numbers used in the expression"),
  }),
  execute: async ({ expression, vars }) => {
    try {
      return { value: evalFormula(expression, vars ?? {}) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

/**
 * Writes a new practice exam modeled on the review's past exams: same structure, matched difficulty, new settings,
 * full solutions with numbers checked by the calc tool. Throws when the review has no past exams to model or the
 * output does not fit the review (unknown sections, a missing solution).
 */
export async function generatePracticeExam(
  review: Review,
  opts: GenerateOptions,
  previous: PracticeSet[],
  model: LanguageModel = GENERATION_MODEL, // tests pass a mock
): Promise<PracticeSet> {
  const { system, prompt, targets } = buildGenerationPrompt(review, opts, previous);
  if (targets.length === 0) throw new Error("No past exams to model this on.");
  const { output } = await generateText({
    model,
    system,
    prompt,
    tools: { calc },
    stopWhen: isStepCount(60),
    output: Output.object({ schema: generatedExamOutputSchema }),
  });
  const modelId = typeof model === "string" ? model : model.modelId;
  const set = practiceSetSchema.parse(toPracticeSet(output, opts, { id: randomUUID(), model: modelId, createdAt: new Date().toISOString() }));
  const issues = questionIssues(set.questions, new Set(review.sections.map((s) => s.id)));
  if (issues.length) throw new Error(`The generated exam did not fit this review (${issues[0].message}). Try again.`);
  return set;
}
