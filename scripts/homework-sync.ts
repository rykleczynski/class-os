/**
 * Uploads passcode-gated homework sets from the gitignored content/homework/ directory into
 * Supabase through the service-role-only homework_upsert RPC (0003_homework.sql). Content and
 * the passcode go from disk and env straight to Supabase; neither is ever printed.
 *
 *   HOMEWORK_PASSCODE=... npm run homework:sync -- [--dry-run] [--only <slug>]
 *
 * Each file is content/homework/<slug>.json: { slug, courseCode, title, dueAt, spec }, with spec
 * checked against lib/homework-spec.ts. Every set uploaded in one run gets the same passcode, and
 * re-running replaces the passcode hash. Saved answers are never touched.
 * --dry-run validates the files only: no secret key, no network.
 * Exit codes: 0 ok, 1 some files skipped, 2 usage, missing passcode or missing key.
 *
 * Requires SUPABASE_SECRET_KEY (server-only; see .env.example) unless --dry-run.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { homeworkFileSchema } from "../lib/homework-spec";

const MIN_PASSCODE = 16;
const dir = join(__dirname, "..", "content", "homework");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
if (onlyIdx >= 0 && !only) {
  console.error("--only needs a slug");
  process.exit(2);
}

const passcode = process.env.HOMEWORK_PASSCODE ?? "";
if (passcode.length < MIN_PASSCODE) {
  console.error(`HOMEWORK_PASSCODE must be set and at least ${MIN_PASSCODE} characters (use a long random one)`);
  process.exit(2);
}

async function main() {
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_") && (!only || f === `${only}.json`))
    : [];
  if (files.length === 0) {
    console.error(only ? `no content/homework/${only}.json` : "no files in content/homework/");
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
  for (const f of files) {
    const name = f.slice(0, -".json".length);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch {
      console.error(`${name}: skipped: invalid JSON`);
      failed++;
      continue;
    }
    const parsed = homeworkFileSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      console.error(`${name}: skipped: schema invalid (${parsed.error.issues.length} issues, first at ${first.path.join(".") || "(root)"})`);
      failed++;
      continue;
    }
    const hw = parsed.data;
    if (hw.slug !== name) {
      console.error(`${name}: skipped: slug does not match the file name`);
      failed++;
      continue;
    }
    const summary = `${hw.courseCode}, ${hw.spec.modules.length} modules`;
    if (!db) {
      console.log(`${hw.slug}: dry-run ok, ${summary}`);
      continue;
    }
    const { error } = await db.rpc("homework_upsert", {
      p_slug: hw.slug,
      p_course_code: hw.courseCode,
      p_title: hw.title,
      p_due_at: hw.dueAt,
      p_spec: hw.spec,
      p_passcode: passcode,
    });
    if (error) {
      // Postgres error messages from homework_upsert carry no content or passcode.
      console.error(`${hw.slug}: skipped: ${error.message}`);
      failed++;
      continue;
    }
    console.log(`${hw.slug}: upserted, ${summary}`);
  }
  process.exit(failed ? 1 : 0);
}

void main();
