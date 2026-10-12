"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HOMEWORK_LIMITS, type HomeworkStatus } from "./homework-spec";
import { fetchHomework, saveHomeworkAnswer, type SaveHomeworkResult } from "./homework";
import { HOMEWORK_SLUG as SLUG, homeworkCookieName as cookieName, homeworkPath as cookiePath, readHomeworkPasscode } from "./homework-cookie";

/**
 * Server actions for /homework/<slug>. These own the passcode cookie: unlock sets it after
 * the database accepts the passcode, save reads it, lock deletes it. Every action is a public
 * POST endpoint, so inputs are bounded here and the passcode is re-checked by the RPC on
 * every call.
 */
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export type UnlockState = { error: string } | null;

/** For useActionState: bind the slug, then pass the form. Redirects back to the page on success. */
export async function unlockHomework(slug: string, _prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const raw = formData.get("passcode");
  const passcode = typeof raw === "string" ? raw.trim() : "";
  if (!SLUG.test(slug) || !passcode || passcode.length > HOMEWORK_LIMITS.passcode) return { error: "Wrong passcode" };

  const res = await fetchHomework(slug, passcode);
  // A spec that fails validation still proves the passcode; the page explains the spec problem.
  if (!res.ok && res.reason !== "invalid-spec") {
    if (res.reason === "disabled") return { error: "Homework needs Supabase, which is not configured here." };
    if (res.reason === "error") return { error: "Could not check the passcode. Try again." };
    return { error: "Wrong passcode" };
  }

  (await cookies()).set(cookieName(slug), passcode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax so a link opened from Messages or Gmail still sends it. Actions keep Next's origin check.
    sameSite: "lax",
    path: cookiePath(slug),
    maxAge: MAX_AGE,
  });
  redirect(cookiePath(slug));
}

export async function saveAnswer(
  slug: string,
  moduleId: string,
  answer: string,
  status: HomeworkStatus | null,
): Promise<SaveHomeworkResult | { ok: false; reason: "locked" }> {
  if (
    typeof slug !== "string" || !SLUG.test(slug) ||
    typeof moduleId !== "string" || moduleId.length < 1 || moduleId.length > HOMEWORK_LIMITS.moduleId ||
    typeof answer !== "string" || answer.length > HOMEWORK_LIMITS.answer ||
    (status !== null && status !== "got" && status !== "review")
  ) {
    return { ok: false, reason: "invalid-input" };
  }
  const passcode = await readHomeworkPasscode(slug);
  if (!passcode) return { ok: false, reason: "locked" };
  return saveHomeworkAnswer({ slug, passcode, moduleId, answer, status });
}

/** Forgets the passcode on this browser. Deleting a cookie re-renders the page, which then shows the form. */
export async function lockHomework(slug: string): Promise<void> {
  if (typeof slug !== "string" || !SLUG.test(slug)) return;
  (await cookies()).delete({ name: cookieName(slug), path: cookiePath(slug) });
}
