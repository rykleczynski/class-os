/**
 * Uploads exam reviews from the gitignored content/reviews/<slug>/review.json into the reviews table
 * (0006_reviews.sql) with the service-role key. Content goes from disk straight to Supabase and is never printed.
 *
 *   npm run review:sync -- [--dry-run] [--only <slug>]
 *
 * Each file is validated against lib/review/schema.ts first; an invalid review is skipped, never uploaded.
 * --dry-run validates only: no key, no network. Exit codes: 0 ok, 1 some reviews skipped, 2 usage or missing key,
 * 5 Supabase rejected the key.
 *
 * Requires SUPABASE_SECRET_KEY (server-only; see .env.example) unless --dry-run.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reviewsRoot } from "../lib/review/paths";
import { reviewErrors, reviewSchema } from "../lib/review/schema";
import { isAuthError } from "./content-state";

const TERM = "Fall 2026";
const root = reviewsRoot(join(__dirname, ".."));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
if (onlyIdx >= 0 && !only) {
  console.error("--only needs a slug");
  process.exit(2);
}

async function main() {
  const slugs = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_") && (!only || d.name === only) && existsSync(join(root, d.name, "review.json")))
        .map((d) => d.name)
    : [];
  if (slugs.length === 0) {
    console.error(only ? `no content/reviews/${only}/review.json` : "no reviews in content/reviews/");
    process.exit(2);
  }

  let db: SupabaseClient | null = null;
  if (!dryRun) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://etvmpkygvfxwocvlrpya.supabase.co";
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!key) {
      console.error("SUPABASE_SECRET_KEY is not set (see .env.example)");
      process.exit(2);
    }
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  let failed = 0;
  for (const slug of slugs) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(root, slug, "review.json"), "utf8"));
    } catch {
      console.error(`${slug}: skipped: invalid JSON`);
      failed++;
      continue;
    }
    const parsed = reviewSchema.safeParse(raw);
    const errors = parsed.success ? reviewErrors(parsed.data.sections) : [];
    if (!parsed.success || errors.length) {
      const first = parsed.success ? errors[0] : parsed.error.issues[0].path.join(".") || "(root)";
      console.error(`${slug}: skipped: invalid (run npm run validate:review; first at ${first})`);
      failed++;
      continue;
    }
    const r = parsed.data;
    if (r.slug !== slug) {
      console.error(`${slug}: skipped: slug does not match the directory name`);
      failed++;
      continue;
    }
    const summary = `${r.courseCode}, ${r.sections.length} sections, ${r.practiceExam.questions.length} practice questions`;
    if (!db) {
      console.log(`${slug}: dry-run ok, ${summary}`);
      continue;
    }
    try {
      const { data: course, error: cErr } = await db.from("courses").select("id").eq("code", r.courseCode).eq("term", TERM).maybeSingle();
      if (cErr) throw new Error(`course lookup: ${cErr.message}`);
      if (!course) throw new Error(`no course ${r.courseCode} / ${TERM}`);
      const { error } = await db.from("reviews").upsert(
        {
          slug: r.slug,
          course_id: course.id,
          title: r.title,
          exam_title: r.exam.title,
          exam_at: r.exam.startsAt,
          spec: r,
          schema_version: r.schema_version,
          generated_at: r.generatedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      );
      if (error) throw new Error(`review upsert: ${error.message}`);
      console.log(`${slug}: upserted, ${summary}`);
    } catch (err) {
      const msg = (err as Error).message;
      failed++;
      if (isAuthError(msg)) {
        console.error(`${slug}: sync: auth error, check SUPABASE_SECRET_KEY in ~/class_OS/.env.local`);
        process.exit(5);
      }
      console.error(`${slug}: skipped: ${msg}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

void main();
