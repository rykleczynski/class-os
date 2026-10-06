/**
 * Upserts lesson JSON and transcript text from lib/fixtures into Supabase with the
 * service-role key. Files go from disk straight to Supabase; content is never printed.
 *
 *   npm run sync -- [--dry-run] [--only <slug>]
 *
 * Requires SUPABASE_SECRET_KEY (server-only; see .env.example).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lessonSchema } from "../lib/lesson/schema";
import { manifest } from "../lib/fixtures/manifest";

const TERM = "Fall 2026";
const MIN_TRANSCRIPT_CHARS = 1000;
const root = join(__dirname, "..", "lib", "fixtures");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
if (onlyIdx >= 0 && !only) {
  console.error("--only needs a slug");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://etvmpkygvfxwocvlrpya.supabase.co";
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) {
  console.error("SUPABASE_SECRET_KEY is not set (see .env.example)");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** Returns the transcript text if the file is usable, else a reason string. */
function readTranscript(file: string | null): { text: string } | { reason: string } {
  if (!file) return { reason: "no transcript file in manifest" };
  const p = join(root, "transcripts", file);
  if (!existsSync(p)) return { reason: "transcript file missing" };
  const text = readFileSync(p, "utf8");
  if (text.length <= MIN_TRANSCRIPT_CHARS) return { reason: `transcript too short (${text.length} chars)` };
  if (text.includes("<<<")) return { reason: "transcript has <<< markers" };
  return { text };
}

async function main() {
  const entries = manifest.filter((e) => !only || e.slug === only);
  if (only && entries.length === 0) {
    console.error(`no manifest entry for ${only}`);
    process.exit(2);
  }
  const courseIds = new Map<string, string>();
  let failed = 0;

  for (const e of entries) {
    const lessonPath = join(root, "lessons", `${e.slug}.json`);
    if (!existsSync(lessonPath)) {
      console.warn(`${e.slug}: skipped: lesson file missing`);
      failed++;
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(lessonPath, "utf8"));
    } catch {
      console.error(`${e.slug}: skipped: invalid JSON`);
      failed++;
      continue;
    }
    const parsed = lessonSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`${e.slug}: skipped: schema invalid (${parsed.error.issues.length} issues, first at ${parsed.error.issues[0].path.join(".") || "(root)"})`);
      failed++;
      continue;
    }
    const lesson = parsed.data;
    const t = readTranscript(e.transcriptFile);
    const transcriptNote = "text" in t ? `transcript ${t.text.length} chars` : `transcript kept existing (${t.reason})`;

    if (dryRun) {
      console.log(`${e.slug}: dry-run ok, ${transcriptNote}`);
      continue;
    }

    try {
      let courseId = courseIds.get(e.courseCode);
      if (!courseId) {
        const { data, error } = await db.from("courses").select("id").eq("code", e.courseCode).eq("term", TERM).maybeSingle();
        if (error) throw new Error(`course lookup: ${error.message}`);
        if (!data) throw new Error(`no course ${e.courseCode} / ${TERM}`);
        courseId = data.id as string;
        courseIds.set(e.courseCode, courseId);
      }

      const lectureRow: Record<string, unknown> = {
        course_id: courseId,
        wispr_meeting_id: e.sourceId,
        starts_at: e.startsAt,
        ends_at: e.endsAt,
        wispr_share_link: e.wisprShareLink,
        status: "generated",
      };
      if ("text" in t) lectureRow.transcript = t.text;
      const { data: lec, error: lecErr } = await db
        .from("lectures")
        .upsert(lectureRow, { onConflict: "wispr_meeting_id" })
        .select("id")
        .single();
      if (lecErr) throw new Error(`lecture upsert: ${lecErr.message}`);

      const { error: lesErr } = await db.from("lessons").upsert(
        {
          slug: e.slug,
          lecture_id: lec.id,
          title: lesson.title,
          summary: e.summary ?? lesson.hook,
          est_minutes: lesson.est_minutes,
          spec: lesson,
          schema_version: lesson.schema_version,
          status: "published",
        },
        { onConflict: "slug" },
      );
      if (lesErr) throw new Error(`lesson upsert: ${lesErr.message}`);
      console.log(`${e.slug}: lesson upserted, ${transcriptNote}`);
    } catch (err) {
      console.error(`${e.slug}: skipped: ${(err as Error).message}`);
      failed++;
    }
  }
  process.exit(failed ? 1 : 0);
}

void main();
