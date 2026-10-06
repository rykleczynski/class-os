import { z } from "zod";

/**
 * The Lesson contract. Everything the generator emits and everything the
 * renderer accepts goes through these schemas. Bump SCHEMA_VERSION on any
 * breaking change.
 */
export const SCHEMA_VERSION = 1 as const;

const blockId = z
  .string()
  .min(1)
  .optional()
  .describe("Stable id for attempt tracking. Defaults to <stepId>:<index>.");

const caption = z.string().optional();

// ---- Block schemas ---------------------------------------------------------

export const proseBlock = z.object({
  type: z.literal("prose"),
  id: blockId,
  md: z.string().min(1).describe("Short markdown. Never stands alone in a step."),
});

export const keyIdeaBlock = z.object({
  type: z.literal("keyIdea"),
  id: blockId,
  text: z.string().min(1),
});

export const chartBlock = z.object({
  type: z.literal("chart"),
  id: blockId,
  kind: z.enum(["line", "bar", "area", "scatter"]),
  title: z.string().optional(),
  data: z
    .array(z.record(z.string(), z.union([z.string(), z.number()])))
    .min(1),
  x: z.string().describe("Key in each data row used for the x axis."),
  y: z
    .union([z.string(), z.array(z.string()).min(1)])
    .describe("Key (or keys, for multiple series) used for the y axis."),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  annotations: z
    .array(
      z.object({
        x: z.union([z.string(), z.number()]),
        y: z.number().optional(),
        label: z.string(),
      }),
    )
    .optional(),
  caption,
});

export const sliderVar = z.object({
  name: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Variable names must be identifiers"),
  label: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  default: z.number(),
  unit: z.string().optional(),
});

export const sliderBlock = z.object({
  type: z.literal("slider"),
  id: blockId,
  title: z.string().optional(),
  formula: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "Math expression over the named vars, evaluated with a restricted mathjs. Operators + - * / ^ ( ), and sqrt, exp, log, abs, min, max, round, floor, ceil, pi, e. No assignments or function definitions.",
    ),
  vars: z.array(sliderVar).min(1).max(6),
  output: z.object({
    label: z.string(),
    format: z.enum(["number", "currency", "percent"]).default("number"),
    decimals: z.number().int().min(0).max(6).optional(),
    unit: z.string().optional(),
  }),
  plot: z
    .object({
      x: z.string().describe("Name of the var swept along the x axis."),
      range: z.tuple([z.number(), z.number()]).optional(),
      points: z.number().int().min(10).max(400).optional(),
      yLabel: z.string().optional(),
      zeroLine: z.boolean().optional(),
    })
    .optional(),
  caption,
});

const curve = z.object({
  label: z.string(),
  kind: z.enum(["supply", "demand", "other"]).default("other"),
  intercept: z.number().describe("Price at quantity 0 (P = intercept + slope * Q)."),
  slope: z.number(),
  color: z.string().optional(),
});

export const supplyDemandBlock = z.object({
  type: z.literal("supplyDemand"),
  id: blockId,
  title: z.string().optional(),
  curves: z.array(curve).min(1).max(6),
  shifts: z
    .array(
      z.object({
        of: z.string().describe("Label of the curve being shifted."),
        label: z.string(),
        intercept: z.number().optional(),
        slope: z.number().optional(),
        color: z.string().optional(),
      }),
    )
    .optional(),
  areas: z
    .array(
      z.object({
        label: z.string(),
        curves: z
          .tuple([z.string(), z.string()])
          .describe("Labels (base or shifted) of the two curves bounding the area."),
        from: z.number(),
        to: z.number(),
        color: z.string().optional(),
      }),
    )
    .optional(),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  xMax: z.number().positive().optional(),
  yMax: z.number().positive().optional(),
  caption,
});

export const timelineBlock = z.object({
  type: z.literal("timeline"),
  id: blockId,
  title: z.string().optional(),
  events: z
    .array(
      z.object({
        when: z.string(),
        title: z.string(),
        detail: z.string().optional(),
        amount: z
          .number()
          .optional()
          .describe("Cash flow in dollars; renders as a green inflow or red outflow."),
      }),
    )
    .min(2),
  caption,
});

export const compareBlock = z.object({
  type: z.literal("compare"),
  id: blockId,
  title: z.string().optional(),
  columns: z.array(z.string()).min(2).max(5),
  rows: z
    .array(z.object({ label: z.string(), cells: z.array(z.string()) }))
    .min(1),
  highlight: z.number().int().min(0).optional().describe("Column index to emphasize."),
  caption,
});

export const stepperBlock = z.object({
  type: z.literal("stepper"),
  id: blockId,
  title: z.string().optional(),
  frames: z
    .array(
      z.object({
        title: z.string(),
        text: z.string(),
        math: z.string().optional().describe("One line shown in a monospace panel."),
      }),
    )
    .min(2),
});

export const flipBlock = z.object({
  type: z.literal("flip"),
  id: blockId,
  front: z.string(),
  back: z.string(),
});

export const mcqBlock = z.object({
  type: z.literal("mcq"),
  id: blockId,
  q: z.string(),
  options: z.array(z.string()).min(2).max(6),
  answer: z.number().int().min(0).describe("Index of the correct option."),
  why: z.string(),
});

export const sortOrMatchBlock = z
  .object({
    type: z.literal("sortOrMatch"),
    id: blockId,
    mode: z.enum(["order", "match"]),
    prompt: z.string(),
    items: z
      .array(
        z.object({
          label: z.string(),
          target: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("match mode: index into targets."),
        }),
      )
      .min(2),
    targets: z.array(z.string()).optional().describe("match mode only."),
    why: z.string().optional(),
  })
  .superRefine((b, ctx) => {
    if (b.mode === "match") {
      if (!b.targets || b.targets.length < 2) {
        ctx.addIssue({ code: "custom", message: "match mode needs targets (2+)", path: ["targets"] });
        return;
      }
      b.items.forEach((it, i) => {
        if (it.target === undefined || it.target >= b.targets!.length) {
          ctx.addIssue({ code: "custom", message: "item.target must index into targets", path: ["items", i, "target"] });
        }
      });
    }
  });

export const scenarioBlock = z.object({
  type: z.literal("scenario"),
  id: blockId,
  title: z.string().optional(),
  prompt: z.string(),
  choices: z
    .array(
      z.object({
        label: z.string(),
        outcome: z.string(),
        verdict: z.enum(["best", "ok", "poor"]),
      }),
    )
    .min(2)
    .max(5),
  debrief: z.string(),
});

export const inTheNewsBlock = z.object({
  type: z.literal("inTheNews"),
  id: blockId,
  headline: z.string(),
  source: z.string(),
  url: z.url(),
  date: z.string(),
  tieIn: z.string(),
  placeholder: z.boolean().optional().describe("True when the story is not a verified real link."),
});

export const customBlock = z.object({
  type: z.literal("custom"),
  id: blockId,
  html: z.string().min(1),
  height: z.number().int().min(80).max(1200),
  caption,
});

export const blockSchema = z.discriminatedUnion("type", [
  proseBlock,
  keyIdeaBlock,
  chartBlock,
  sliderBlock,
  supplyDemandBlock,
  timelineBlock,
  compareBlock,
  stepperBlock,
  flipBlock,
  mcqBlock,
  sortOrMatchBlock,
  scenarioBlock,
  inTheNewsBlock,
  customBlock,
]);

export const BLOCK_TYPES = [
  "prose", "keyIdea", "chart", "slider", "supplyDemand", "timeline", "compare",
  "stepper", "flip", "mcq", "sortOrMatch", "scenario", "inTheNews", "custom",
] as const;

// ---- Step / Lesson ---------------------------------------------------------

/** Strict step schema, used by the validator and the generator. */
export const stepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(blockSchema).min(1),
});

const lessonBase = {
  schema_version: z.literal(SCHEMA_VERSION),
  title: z.string().min(1),
  hook: z.string().min(1),
  est_minutes: z.number().min(3).max(25),
  objectives: z.array(z.string()).length(3),
  recap: z.array(z.string()).min(2).max(5),
  quiz: z.array(mcqBlock).length(5),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })).min(3).max(12),
  concepts: z.array(z.string()).min(1),
};

export const lessonSchema = z.object({
  ...lessonBase,
  steps: z.array(stepSchema).min(3).max(7),
});

/** Same as lessonSchema but blocks are validated one at a time by the renderer. */
export const lessonShellSchema = z.object({
  ...lessonBase,
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        blocks: z.array(z.unknown()),
      }),
    )
    .min(1),
});

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type ProseBlock = z.infer<typeof proseBlock>;
export type KeyIdeaBlock = z.infer<typeof keyIdeaBlock>;
export type ChartBlock = z.infer<typeof chartBlock>;
export type SliderBlock = z.infer<typeof sliderBlock>;
export type SupplyDemandBlock = z.infer<typeof supplyDemandBlock>;
export type TimelineBlock = z.infer<typeof timelineBlock>;
export type CompareBlock = z.infer<typeof compareBlock>;
export type StepperBlock = z.infer<typeof stepperBlock>;
export type FlipBlock = z.infer<typeof flipBlock>;
export type McqBlock = z.infer<typeof mcqBlock>;
export type SortOrMatchBlock = z.infer<typeof sortOrMatchBlock>;
export type ScenarioBlock = z.infer<typeof scenarioBlock>;
export type InTheNewsBlock = z.infer<typeof inTheNewsBlock>;
export type CustomBlock = z.infer<typeof customBlock>;
export type Step = z.infer<typeof stepSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Flashcard = Lesson["flashcards"][number];

/** Callback fired by interactive blocks. Persistence comes later. */
export type OnAttempt = (blockId: string, answer: unknown, correct: boolean) => void;

// ---- Prose lint (shared by validator and tests) ----------------------------

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function stepProseWords(step: { blocks: Array<{ type: string; md?: string }> }): number {
  return step.blocks.reduce(
    (n, b) => n + (b.type === "prose" && typeof b.md === "string" ? wordCount(b.md) : 0),
    0,
  );
}

const TEXT_ONLY = new Set<string>(["prose", "keyIdea"]);
export function stepHasVisualOrInteraction(step: { blocks: Array<{ type: string }> }): boolean {
  return step.blocks.some((b) => !TEXT_ONLY.has(b.type));
}
