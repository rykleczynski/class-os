import "server-only";
import { z } from "zod";
import { HOMEWORK_LIMITS, homeworkSpecSchema, type HomeworkSpec, type HomeworkStatus } from "./homework-spec";
import { getSupabase } from "./supabase/client";

/**
 * Homework data access: the two passcode-checked RPCs from 0003_homework.sql, called with
 * the publishable key. No cookies here; lib/homework-actions.ts decides when to call these.
 */
export type HomeworkAnswer = { module_id: string; answer: string; status: HomeworkStatus | null; updated_at: string };

export type HomeworkSet = {
  slug: string;
  title: string;
  due_at: string | null;
  course_code: string;
  course_slug: string;
  spec: HomeworkSpec;
  answers: HomeworkAnswer[];
};

export type FetchHomeworkResult =
  | { ok: true; set: HomeworkSet }
  | { ok: false; reason: "disabled" | "locked" | "invalid-spec" | "error" };

export type SaveHomeworkResult = { ok: true } | { ok: false; reason: "disabled" | "invalid-input" | "rejected" | "error" };

const rowSchema = z.object({
  slug: z.string(),
  title: z.string(),
  due_at: z.string().nullable(),
  course_code: z.string(),
  course_slug: z.string(),
  spec: z.unknown(),
  answers: z.array(
    z.object({
      module_id: z.string(),
      answer: z.string(),
      status: z.enum(["got", "review"]).nullable(),
      updated_at: z.string(),
    }),
  ),
});

/** Null passcode or a wrong one both come back as "locked"; the RPC never says which. */
export async function fetchHomework(slug: string, passcode: string | null): Promise<FetchHomeworkResult> {
  const db = getSupabase();
  if (!db) return { ok: false, reason: "disabled" };
  if (!passcode || passcode.length > HOMEWORK_LIMITS.passcode || slug.length > HOMEWORK_LIMITS.slug) {
    return { ok: false, reason: "locked" };
  }
  const { data, error } = await db.rpc("homework_get", { p_slug: slug, p_passcode: passcode });
  if (error) {
    console.error(`homework_get ${slug}: ${error.message}`);
    return { ok: false, reason: "error" };
  }
  if (data === null) return { ok: false, reason: "locked" };
  const row = rowSchema.safeParse(data);
  const spec = row.success ? homeworkSpecSchema.safeParse(row.data.spec) : null;
  if (!row.success || !spec?.success) return { ok: false, reason: "invalid-spec" };
  return { ok: true, set: { ...row.data, spec: spec.data } };
}

export async function saveHomeworkAnswer(input: {
  slug: string;
  passcode: string;
  moduleId: string;
  answer: string;
  status: HomeworkStatus | null;
}): Promise<SaveHomeworkResult> {
  const db = getSupabase();
  if (!db) return { ok: false, reason: "disabled" };
  const { slug, passcode, moduleId, answer, status } = input;
  const { error, data } = await db.rpc("homework_save", {
    p_slug: slug,
    p_passcode: passcode,
    p_module_id: moduleId,
    p_answer: answer,
    // Omitted means null in the function's signature.
    ...(status ? { p_status: status } : {}),
  });
  if (error) {
    console.error(`homework_save ${slug}/${moduleId}: ${error.message}`);
    return { ok: false, reason: "error" };
  }
  return data === true ? { ok: true } : { ok: false, reason: "rejected" };
}
