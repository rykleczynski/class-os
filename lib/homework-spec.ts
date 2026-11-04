import { z } from "zod";

/**
 * The homework contract, shared by the page (lib/homework.ts) and the upload script
 * (scripts/homework-sync.ts). It holds no content: problem text and sample answers
 * live in Supabase and in the gitignored content/homework/ directory only.
 * `concept` and `steps` are optional, so sets stored before the flashcard deck still validate.
 * lib/homework-deck.ts turns a spec into the ordered cards the page shows.
 */
export const homeworkModuleSchema = z.object({
  /** Sub-question id, e.g. "4d". Also the key for saved answers. */
  id: z.string().min(1).max(40),
  /** Setup text shared with the following sub-questions. */
  ctx: z.string().min(1).optional(),
  q: z.string().min(1),
  /** Where in lecture this is covered. */
  ptr: z.string().min(1),
  nudge: z.string().min(1).nullable(),
  /** Sample answer paragraphs. A string starting with "~" is a monospace derivation; newlines are kept. */
  s: z.array(z.string().min(1)).min(1),
  /** Teaching text, shown as its own card right before this module's card. Body strings are markdown for components/Md.tsx. */
  concept: z
    .object({
      title: z.string().min(1),
      body: z.array(z.string().min(1)).min(1),
    })
    .optional(),
  /** Numbered how-to-solve steps, shown on the back of the card. Plain text, like `s`. */
  steps: z.array(z.string().min(1)).min(1).optional(),
});

export const homeworkSpecSchema = z
  .object({
    banner: z.object({
      title: z.string().min(1),
      /** Inline markdown (**bold**, *italic*) as rendered by components/Md.tsx. */
      items: z.array(z.string().min(1)),
    }),
    modules: z.array(homeworkModuleSchema).min(1),
  })
  .refine((s) => new Set(s.modules.map((m) => m.id)).size === s.modules.length, {
    message: "module ids must be unique",
    path: ["modules"],
  });

export type HomeworkModule = z.infer<typeof homeworkModuleSchema>;
export type HomeworkSpec = z.infer<typeof homeworkSpecSchema>;
export type HomeworkStatus = "got" | "review";

/** Shape of content/homework/<slug>.json, read only by scripts/homework-sync.ts. */
export const homeworkFileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  spec: homeworkSpecSchema,
});

/** Limits shared by the action, the service and the migration's checks. */
export const HOMEWORK_LIMITS = { slug: 80, moduleId: 40, answer: 20000, passcode: 200 } as const;
