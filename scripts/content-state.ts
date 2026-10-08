/**
 * Small pure helpers over content/<slug>/ shared by sync, the gate and materials. No network.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SYNCED_MARKER = ".synced";

/** lesson.json and meta.json are both on disk. */
export const hasGeneratedFiles = (contentRoot: string, slug: string) =>
  existsSync(join(contentRoot, slug, "lesson.json")) && existsSync(join(contentRoot, slug, "meta.json"));

/** Generated files exist but the last sync did not complete (no marker, or the files changed after it). */
export function isUnsynced(contentRoot: string, slug: string): boolean {
  if (!hasGeneratedFiles(contentRoot, slug)) return false;
  const dir = join(contentRoot, slug);
  const marker = join(dir, SYNCED_MARKER);
  if (!existsSync(marker)) return true;
  const at = statSync(marker).mtimeMs;
  return statSync(join(dir, "lesson.json")).mtimeMs > at || statSync(join(dir, "meta.json")).mtimeMs > at;
}

export const markSynced = (contentRoot: string, slug: string) =>
  writeFileSync(join(contentRoot, slug, SYNCED_MARKER), new Date().toISOString() + "\n");

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
