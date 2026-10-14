"use server";

import { isOwner } from "./auth";
import { getAdmin } from "./supabase/admin";
import type { Json } from "./supabase/types";

/**
 * Persist one answer to the attempts table. Owner only: the table has no anon grant any more,
 * and guests never reach this (their player skips it). Resolves the lesson slug to its uuid
 * first. Returns quietly when Supabase is not configured or the lesson is a fixture that is
 * not in the database.
 */
export async function recordAttempt(lessonSlug: string, blockId: string, answer: unknown, correct: boolean) {
  // Every server action is a public POST endpoint, so check who is calling first, then keep inputs bounded.
  if (!(await isOwner())) return { ok: false as const, reason: "unauthorized" };
  if (typeof lessonSlug !== "string" || typeof blockId !== "string" || lessonSlug.length > 200 || blockId.length > 200 || typeof correct !== "boolean") {
    return { ok: false as const, reason: "invalid-input" };
  }
  const db = getAdmin();
  if (!db) return { ok: false as const, reason: "supabase-disabled" };
  const { data: lesson } = await db.from("lessons").select("id").eq("slug", lessonSlug).maybeSingle();
  if (!lesson) return { ok: false as const, reason: "lesson-not-found" };
  const { error } = await db
    .from("attempts")
    .insert({ lesson_id: lesson.id, block_id: blockId, answer: (answer ?? null) as Json, correct });
  return error ? { ok: false as const, reason: error.message } : { ok: true as const };
}
