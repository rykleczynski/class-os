/**
 * Upserts lesson JSON and transcript text from lib/fixtures into Supabase with the
 * service-role key. Files go from disk straight to Supabase; content is never printed.
 *
 *   npm run sync -- [--dry-run] [--only <slug>] [--content-only] [--unsynced]
 *
 * Sources: the repo manifest (lib/fixtures) plus the gitignored content/ directory,
 * where each generated lecture is content/<slug>/{lesson.json,meta.json,transcript.txt?}.
 * --content-only skips the manifest. Directories starting with "_" are ignored.
 * --unsynced syncs only content/ lessons whose last sync did not complete (no content/<slug>/.synced marker, or the
 * files changed after it) and prints nothing when there are none. run.sh uses it so a failed sync is retried
 * without starting Claude. Exit codes: 0 ok, 1 some lessons skipped, 2 usage or missing key, 5 Supabase rejected the key.
 *
 * Requires SUPABASE_SECRET_KEY (server-only; see .env.example).
 */
import { existsSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lessonSchema } from "../lib/lesson/schema";
import { z } from "zod";
import { manifest, type ManifestEntry } from "../lib/fixtures/manifest";
import { isAuthError, isUnsynced, markSynced } from "./content-state";

const TERM = "Fall 2026";
const MIN_TRANSCRIPT_CHARS = 1000;
const root = join(__dirname, "..", "lib", "fixtures");
const contentRoot = join(__dirname, "..", "content");

const metaSchema = z.object({
  slug: z.string().min(1),
  courseCode: z.string().min(1),
  sourceId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  wisprShareLink: z.string().nullable(),
  transcriptFile: z.string().nullable(),
  summary: z.string().nullable(),
  /** Chapter or topic whose slides were not in materials/ when the lesson was written. Absent or null means fine. */
  materials_missing: z.string().nullable().optional(),
});

type Entry = ManifestEntry & { lessonPath: string; transcriptPath: string | null; transcriptRoot: string };

/** True when p resolves (through symlinks) to a path inside base. A missing file passes; readTranscript reports it. */
function isInside(base: string, p: string): boolean {
  if (!existsSync(p)) return true;
  const rel = relative(realpathSync(base), realpathSync(p));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function manifestEntries(): Entry[] {
  return manifest.map((e) => ({
    ...e,
    lessonPath: join(root, "lessons", `${e.slug}.json`),
    transcriptPath: e.transcriptFile ? join(root, "transcripts", e.transcriptFile) : null,
    transcriptRoot: join(root, "transcripts"),
  }));
}

/** Reads content/<slug>/meta.json for every non-underscore directory. Bad meta is reported and skipped. */
function contentEntries(only?: string): { entries: Entry[]; bad: number } {
  const entries: Entry[] = [];
  let bad = 0;
  if (!existsSync(contentRoot)) return { entries, bad };
  for (const d of readdirSync(contentRoot, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith("_")) continue;
    if (only && d.name !== only) continue; // a targeted sync only reports its own result
    const dir = join(contentRoot, d.name);
    const metaPath = join(dir, "meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      const meta = metaSchema.parse(JSON.parse(readFileSync(metaPath, "utf8")));
      if (meta.slug !== d.name) throw new Error("slug does not match directory name");
      const tf = meta.transcriptFile ?? (existsSync(join(dir, "transcript.txt")) ? "transcript.txt" : null);
      entries.push({
        ...meta,
        transcriptFile: tf,
        lessonPath: join(dir, "lesson.json"),
        transcriptPath: tf ? join(dir, tf) : null,
        transcriptRoot: dir,
      });
    } catch (err) {
      console.error(`${d.name}: skipped: bad meta.json (${(err as Error).message.split("\n")[0]})`);
      bad++;
    }
  }
  return { entries, bad };
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
const unsynced = args.includes("--unsynced");
const contentOnly = args.includes("--content-only") || unsynced;
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
function readTranscript(p: string | null, base: string): { text: string } | { reason: string } {
  if (!p) return { reason: "no transcript file" };
  if (!existsSync(p)) return { reason: "transcript file missing" };
  if (!isInside(base, p)) return { reason: "transcript path is outside its lesson directory" };
  const text = readFileSync(p, "utf8");
  if (text.length <= MIN_TRANSCRIPT_CHARS) return { reason: `transcript too short (${text.length} chars)` };
  if (text.includes("<<<")) return { reason: "transcript has <<< markers" };
  return { text };
}

async function main() {
  const content = contentEntries(only);
  const bySlug = new Map<string, Entry>();
  if (!contentOnly) for (const e of manifestEntries()) bySlug.set(e.slug, e);
  for (const e of content.entries) bySlug.set(e.slug, e); // content/ wins on a slug clash
  const contentSlugs = new Set(content.entries.map((e) => e.slug));
  const entries = [...bySlug.values()].filter((e) => (!only || e.slug === only) && (!unsynced || isUnsynced(contentRoot, e.slug)));
  if (unsynced && entries.length === 0) process.exit(0);
  if (only && entries.length === 0) {
    console.error(`no manifest or content entry for ${only}`);
    process.exit(2);
  }
  const courseIds = new Map<string, string>();
  let failed = unsynced ? 0 : content.bad;
  let authFailed = false;

  for (const e of entries) {
    const lessonPath = e.lessonPath;
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
    const t = readTranscript(e.transcriptPath, e.transcriptRoot);
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
          // Only touch the column when meta.json says something, so fixtures and older metas never need it.
          ...("materials_missing" in e ? { materials_missing: e.materials_missing ?? null } : {}),
          status: "published",
        },
        { onConflict: "slug" },
      );
      if (lesErr) throw new Error(`lesson upsert: ${lesErr.message}`);
      console.log(`${e.slug}: lesson upserted, ${transcriptNote}`);
      if (contentSlugs.has(e.slug)) {
        markSynced(contentRoot, e.slug);
        rmSync(join(contentRoot, "_inbox", `${e.slug}.md`), { force: true }); // a stale give-up note no longer applies
      }
    } catch (err) {
      const msg = (err as Error).message;
      failed++;
      if (isAuthError(msg)) {
        console.error(`${e.slug}: sync: auth error, check SUPABASE_SECRET_KEY in ~/class_OS/.env.local`);
        authFailed = true;
        break; // every remaining lesson would fail the same way
      }
      console.error(`${e.slug}: skipped: ${msg}`);
    }
  }
  process.exit(authFailed ? 5 : failed ? 1 : 0);
}

void main();
