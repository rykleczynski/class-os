/**
 * Small pure helpers over content/<slug>/ shared by sync, the gate and materials. No network.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { lessonSchema } from "../lib/lesson/schema";

export const SYNCED_MARKER = ".synced";

export const metaSchema = z.object({
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

/** lesson.json and meta.json are both on disk. */
export const hasGeneratedFiles = (contentRoot: string, slug: string) =>
  existsSync(join(contentRoot, slug, "lesson.json")) && existsSync(join(contentRoot, slug, "meta.json"));

/** Both files parse and pass the same checks sync applies (meta schema, slug matches the directory, lesson schema). */
export function generatedFilesValid(contentRoot: string, slug: string): boolean {
  try {
    const dir = join(contentRoot, slug);
    const meta = metaSchema.parse(JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")));
    if (meta.slug !== slug) return false;
    return lessonSchema.safeParse(JSON.parse(readFileSync(join(dir, "lesson.json"), "utf8"))).success;
  } catch {
    return false;
  }
}

/** Path of the transcript sync would upload: meta.transcriptFile, else transcript.txt when it exists. Null when none. */
function transcriptPath(dir: string): string | null {
  let name: string | null = null;
  try {
    const t = (JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as { transcriptFile?: unknown }).transcriptFile;
    if (typeof t === "string" && t) name = t;
  } catch {
    /* unreadable meta: fall through to the default */
  }
  if (!name && existsSync(join(dir, "transcript.txt"))) name = "transcript.txt";
  return name ? join(dir, name) : null;
}

/** Content hashes of the files a sync uploads. A missing file hashes to "". */
function syncedHashes(dir: string): { lesson: string; meta: string; transcript: string } {
  const h = (p: string | null) => (p && existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : "");
  return { lesson: h(join(dir, "lesson.json")), meta: h(join(dir, "meta.json")), transcript: h(transcriptPath(dir)) };
}

/**
 * Generated files exist and are valid, but the last sync did not complete (no marker, or lesson.json, meta.json or the
 * transcript changed after it). Files that sync would reject are not "unsynced": the generator gets to repair them.
 */
export function isUnsynced(contentRoot: string, slug: string): boolean {
  if (!hasGeneratedFiles(contentRoot, slug)) return false;
  if (!generatedFilesValid(contentRoot, slug)) return false;
  const dir = join(contentRoot, slug);
  const marker = join(dir, SYNCED_MARKER);
  if (!existsSync(marker)) return true;
  try {
    const rec = JSON.parse(readFileSync(marker, "utf8")) as { files?: Record<string, string> };
    const now = syncedHashes(dir);
    return !rec.files || rec.files.lesson !== now.lesson || rec.files.meta !== now.meta || rec.files.transcript !== now.transcript;
  } catch {
    // Legacy marker (timestamp only): fall back to modification times, now including the transcript.
    const at = statSync(marker).mtimeMs;
    const tp = transcriptPath(dir);
    return [join(dir, "lesson.json"), join(dir, "meta.json"), ...(tp && existsSync(tp) ? [tp] : [])].some((f) => statSync(f).mtimeMs > at);
  }
}

export const markSynced = (contentRoot: string, slug: string) => {
  const dir = join(contentRoot, slug);
  writeFileSync(join(dir, SYNCED_MARKER), JSON.stringify({ at: new Date().toISOString(), files: syncedHashes(dir) }) + "\n");
};

/** Supabase rejected the key (as opposed to a content or network problem). */
export const isAuthError = (message: string) => /invalid api key|invalid jwt|jwt expired|unauthorized|\b401\b/i.test(message);

/** Panopto caption file converted to plain text: ready when content/<slug>/transcript.txt exists. */
export function panoptoState(contentRoot: string, slug: string): { ready: boolean; mtimeMs: number; sessionId: string | null } {
  const dir = join(contentRoot, slug);
  const t = join(dir, "transcript.txt");
  if (!existsSync(t)) return { ready: false, mtimeMs: 0, sessionId: null };
  let sessionId: string | null = null;
  try {
    const raw = readFileSync(join(dir, "panopto.json"), "utf8");
    const id = (JSON.parse(raw) as { sessionId?: unknown }).sessionId;
    if (typeof id === "string" && /^[A-Za-z0-9-]+$/.test(id)) sessionId = id;
  } catch {
    /* no sidecar */
  }
  return { ready: true, mtimeMs: statSync(t).mtimeMs, sessionId };
}
