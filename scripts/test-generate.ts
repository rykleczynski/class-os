/**
 * Practice-exam generation tests with the AI SDK's mock model: prompt and difficulty targets, the calc tool loop,
 * structured output, app-assigned ids, and rejection of output that does not fit the review. No network.
 * Usage: npm run test:generate
 */
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { generatePracticeExam } from "../lib/review/generate";
import { buildGenerationPrompt, targetDifficulties } from "../lib/review/generation-prompt";
import { reviewSchema, type PracticeSet, type Review } from "../lib/review/schema";

let failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n  ${e instanceof Error ? e.message : String(e)}`);
  }
}

const q = (id: string, difficulty: number, sectionIds = ["ext"]) => ({
  id,
  sectionIds,
  title: `Question ${id}`,
  setup: "A firm with profit 10q - q^2/2 harms a neighbor with damage q^2/2.",
  parts: [
    { label: "a", prompt: "Find q*.", points: 10 },
    { label: "b", prompt: "Find qFB.", points: 10 },
  ],
  solutions: ["q* = 10.", "qFB = 5."],
  rubric: ["FOC"],
  difficulty,
});
const past = (id: string, diffs: number[]): PracticeSet => ({
  id,
  title: `Past ${id}`,
  kind: "past",
  source: "test",
  minutes: 75,
  instructions: "Closed book.",
  questions: diffs.map((d, i) => q(`${id}-q${i + 1}`, d)),
});

const review: Review = reviewSchema.parse({
  schema_version: 1,
  slug: "test-midterm",
  courseCode: "ECON 134",
  title: "Test review",
  generatedAt: "2026-10-17T12:00:00-07:00",
  exam: {
    title: "Midterm 1",
    kind: "midterm",
    startsAt: null,
    format: ["75 minutes"],
    scope: { summary: "Externalities.", lectures: [{ date: "2026-09-28", title: "L1", lessonSlug: null, topics: ["x"] }], evidence: [{ source: "lecture", quote: "q", meaning: "m" }], excluded: [], gaps: [] },
  },
  studyPlan: [{ when: "Sun", tasks: ["Study"] }],
  bigPicture: "Big picture.",
  sections: [
    {
      id: "ext",
      title: "Externalities",
      lectures: ["2026-09-28"],
      weight: "high",
      weightWhy: "Every exam.",
      summary: "Summary.",
      concepts: [{ term: "Externality", definition: "An effect on others." }],
      formulas: [{ name: "First best", expr: "pi'(qFB) = D'(qFB)", meaning: "MB = MD" }],
      blocks: [],
      workedExamples: [{ title: "W", prompt: "P", steps: [{ title: "a", text: "a" }, { title: "b", text: "b" }], answer: "A" }],
      pitfalls: ["p"],
      quotes: [],
      checks: [
        { type: "mcq", q: "Q1?", options: ["a", "bb", "c"], answer: 0, why: "w" },
        { type: "mcq", q: "Q2?", options: ["a", "bb", "c"], answer: 2, why: "w" },
      ],
    },
  ],
  connections: [],
  practiceExam: { instructions: "I", minutes: 75, questions: [q("m1", 3), q("m2", 3), q("m3", 3)] },
  pastExams: [past("f24", [3, 2, 2]), past("f25", [3, 4, 3, 4])],
  notesSheet: { allowance: "One sheet.", sides: [[{ heading: "h", lines: ["l"] }]] },
  flashcards: Array.from({ length: 10 }, (_, i) => ({ sectionId: "ext", front: `f${i}`, back: "b" })),
  selfCheck: Array.from({ length: 5 }, (_, i) => ({ sectionId: "ext", item: `I can ${i}` })),
});

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } };

/** A model that calls calc once, then answers with `final` as its structured output. Records what it was sent. */
function scriptedModel(final: unknown) {
  const seen: { prompts: unknown[]; toolResult?: unknown } = { prompts: [] };
  let step = 0;
  const model = new MockLanguageModelV4({
    modelId: "mock-exam-writer",
    doGenerate: async (options) => {
      seen.prompts.push(options.prompt);
      step++;
      if (step === 1)
        return {
          content: [{ type: "tool-call", toolCallId: "c1", toolName: "calc", input: JSON.stringify({ expression: "0.5 * (10 - 5) * 5" }) }],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
          warnings: [],
        };
      const last = options.prompt.at(-1);
      if (last?.role === "tool") seen.toolResult = last.content[0];
      return { content: [{ type: "text", text: JSON.stringify(final) }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
    },
  });
  return { model, seen };
}

const goodOutput = {
  title: "Practice: a bakery and a river",
  instructions: "Closed book except your notes sheet. 75 minutes.",
  minutes: 75,
  // No ids: the model never sets them (the output schema omits id).
  questions: [3, 4, 3, 4].map((d, i) => ({ ...q(`x${i}`, d), id: undefined, title: `New question ${i + 1}` })),
};

async function main() {
  await test("targets follow the most recent base exam, shifted and clamped to 1..5", () => {
    assert.deepEqual(targetDifficulties(review.pastExams, "same"), [3, 4, 3, 4]);
    assert.deepEqual(targetDifficulties(review.pastExams, "harder"), [4, 5, 4, 5]);
    assert.deepEqual(targetDifficulties([past("f24", [1, 2])], "easier"), [1, 1]);
    assert.deepEqual(targetDifficulties([], "same"), []);
  });

  await test("the prompt carries the base exams with solutions, the valid section ids and earlier generated titles", () => {
    const prev: PracticeSet = { ...past("gen-old", [3]), kind: "generated", questions: [{ ...q("gen-old-q1", 3), title: "Old orchard question" }] };
    const { system, prompt, targets } = buildGenerationPrompt(review, { basedOn: "f24", difficulty: "same" }, [prev]);
    assert.deepEqual(targets, [3, 2, 2]);
    assert.ok(prompt.includes("Past f24") && !prompt.includes("Past f25"), "only the chosen base exam");
    assert.ok(prompt.includes("Solution: q* = 10."));
    assert.ok(prompt.includes("- ext (high weight)"));
    assert.ok(prompt.includes("Old orchard question"));
    assert.ok(system.includes("calc tool") && system.includes("never copy"));
  });

  await test("a generation runs the calc tool, then returns a validated exam with app-assigned ids", async () => {
    const { model, seen } = scriptedModel(goodOutput);
    const set = await generatePracticeExam(review, { basedOn: "all", difficulty: "same" }, [], model);
    assert.equal(set.kind, "generated");
    assert.match(set.id, /^gen-[0-9a-f]{8}$/);
    assert.deepEqual(set.questions.map((x) => x.id), [1, 2, 3, 4].map((n) => `${set.id}-q${n}`));
    assert.equal(set.generated?.model, "mock-exam-writer");
    assert.equal(set.generated?.difficulty, "same");
    assert.deepEqual(seen.toolResult && (seen.toolResult as { output?: unknown }).output, { type: "json", value: { value: 12.5 } }, "calc evaluated through safe-eval");
  });

  await test("calc refuses unsafe expressions instead of evaluating them", async () => {
    let result: unknown;
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        const last = options.prompt.at(-1);
        if (last?.role !== "tool")
          return { content: [{ type: "tool-call", toolCallId: "c1", toolName: "calc", input: JSON.stringify({ expression: 'evaluate("1+1")' }) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] };
        result = last.content[0];
        return { content: [{ type: "text", text: JSON.stringify(goodOutput) }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
      },
    });
    await generatePracticeExam(review, { basedOn: "all", difficulty: "same" }, [], model);
    const value = (result as { output?: { value?: { error?: string } } }).output?.value;
    assert.ok(value?.error, "returned an error, not a value");
  });

  await test("output that names an unknown section is rejected", async () => {
    const bad = { ...goodOutput, questions: goodOutput.questions.map((x, i) => (i === 0 ? { ...x, sectionIds: ["not-a-section"] } : x)) };
    const { model } = scriptedModel(bad);
    await assert.rejects(generatePracticeExam(review, { basedOn: "all", difficulty: "same" }, [], model), /did not fit this review \(unknown section not-a-section\)/);
  });

  await test("a review with no past exams cannot generate", async () => {
    const { model } = scriptedModel(goodOutput);
    await assert.rejects(generatePracticeExam({ ...review, pastExams: [] }, { basedOn: "all", difficulty: "same" }, [], model), /No past exams/);
  });

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exit(failed ? 1 : 0);
}

void main();
