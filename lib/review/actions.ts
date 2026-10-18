"use server";

import { revalidatePath } from "next/cache";
import { assertOwner } from "../auth";
import { getReview } from "../data";
import { generatePracticeExam } from "./generate";
import { countGeneratedToday, deleteGenerated, listGenerated, saveGenerated } from "./generated-store";
import { generateOptionsSchema } from "./generation-prompt";
import { reviewSchema } from "./schema";

/**
 * Owner-only server actions for generated practice exams. Each is a public POST endpoint, so each re-checks the
 * owner and loads the review itself; only the slug and the options come from the client.
 */
type GenerateResult = { ok: true; id: string } | { ok: false; error: string };

/** Generations per review per day. Each one is a long model call, so a stuck or repeated click must not run up cost. */
const DAILY_GENERATION_CAP = 10;

async function loadReview(slug: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return null;
  const row = await getReview(slug);
  const parsed = row && reviewSchema.safeParse(row.spec);
  return parsed && parsed.success ? parsed.data : null;
}

export async function generateExam(slug: string, options: unknown): Promise<GenerateResult> {
  await assertOwner();
  const review = await loadReview(slug);
  if (!review) return { ok: false, error: "Unknown review." };
  const opts = generateOptionsSchema.safeParse(options);
  if (!opts.success) return { ok: false, error: "Pick which past exam to model and a difficulty." };
  if (review.pastExams.length === 0) return { ok: false, error: "This review has no past exams to model yet." };
  if (opts.data.basedOn !== "all" && !review.pastExams.some((e) => e.id === opts.data.basedOn)) return { ok: false, error: "Unknown past exam." };
  if ((await countGeneratedToday(review.slug)) >= DAILY_GENERATION_CAP)
    return { ok: false, error: `That's ${DAILY_GENERATION_CAP} generated exams today. Sit the ones you have; more tomorrow.` };
  try {
    const set = await generatePracticeExam(review, opts.data, await listGenerated(review.slug));
    await saveGenerated(review.slug, set);
    revalidatePath(`/review/${review.slug}`);
    return { ok: true, id: set.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`generateExam ${review.slug}: ${msg}`);
    if (msg.startsWith("The generated exam")) return { ok: false, error: msg };
    // Retrying will not help until the deployment can reach the AI Gateway (OIDC on Vercel, AI_GATEWAY_API_KEY locally).
    if (/Unauthenticated request to AI Gateway|AI_GATEWAY_API_KEY|OIDC/i.test(msg)) return { ok: false, error: "Exam generation is not set up on this deployment yet (AI Gateway credentials)." };
    return { ok: false, error: "Generating failed. Try again in a minute." };
  }
}

export async function deleteExam(slug: string, id: string): Promise<{ ok: boolean }> {
  await assertOwner();
  const review = await loadReview(slug);
  if (!review || typeof id !== "string") return { ok: false };
  const ok = await deleteGenerated(review.slug, id);
  if (ok) revalidatePath(`/review/${review.slug}`);
  return { ok };
}
