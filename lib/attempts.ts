"use server";

import { getSupabase } from "./supabase/client";
import type { Json } from "./supabase/types";

/**
 * Persist one answer to the attempts table. Resolves the lesson slug to its uuid
 * first. Returns quietly when Supabase is not configured or the lesson is a
 * fixture that is not in the database.
 */
export async function recordAttempt(lessonSlug: string, blockId: string, answer: unknown, correct: boolean) {
  const db = getSupabase();
  if (!db) return { ok: false as const, reason: "supabase-disabled" };
  const { data: lesson } = await db.from("lessons").select("id").eq("slug", lessonSlug).maybeSingle();
  if (!lesson) return { ok: false as const, reason: "lesson-not-found" };
  const { error } = await db
    .from("attempts")
    .insert({ lesson_id: lesson.id, block_id: blockId, answer: (answer ?? null) as Json, correct });
  return error ? { ok: false as const, reason: error.message } : { ok: true as const };
}
