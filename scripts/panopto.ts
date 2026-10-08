/**
 * Panopto (BruinCast) caption helpers. Pure: no fs, no network.
 */
import { codeKey } from "../lib/schedule";

type PanoptoCourse = { code: string; transcript_source?: string };

/** SRT (or WebVTT) to plain text: drops the header, indices, timestamps and cue tags, and joins cue lines. */
export function srtToText(srt: string): string {
  const out: string[] = [];
  for (const raw of srt.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^WEBVTT/i.test(line) || /^(NOTE|STYLE|Kind:|Language:)/.test(line)) continue;
    if (/^\d+$/.test(line)) continue; // cue index
    if (/-->/.test(line)) continue; // timestamp line
    out.push(line.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  }
  return out.filter(Boolean).join("\n") + "\n";
}

/** True when the text has at least one SRT/VTT timestamp line. */
export const looksLikeCaptions = (text: string) => /\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text);

const validDate = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

export type CaptionTarget = { code: string; slug: string; date: string; sessionId: string | null };

/**
 * Maps a downloaded caption file name to a course session. Two shapes:
 *   econ134-2026-10-07.srt  or  econ134-2026-10-07__<sessionId>.srt   (what /refresh-materials writes)
 *   26F-ECON134-1 Week 2 10_07_2026_Captions_English (United States).txt   (Panopto's own name)
 * Only courses with transcript_source "panopto" match. Returns null otherwise.
 */
export function captionTarget(name: string, courseList: PanoptoCourse[]): CaptionTarget | null {
  const panopto = courseList.filter((c) => c.transcript_source === "panopto");
  const known = name.match(/^([a-z]+\d+[a-z]*)-(\d{4})-(\d{2})-(\d{2})(?:__([A-Za-z0-9-]+))?\.(?:srt|txt|vtt)$/i);
  if (known) {
    const c = panopto.find((p) => codeKey(p.code) === known[1].toLowerCase());
    const [y, m, d] = [+known[2], +known[3], +known[4]];
    if (c && validDate(y, m, d)) {
      return { code: c.code, slug: `${codeKey(c.code)}-${known[2]}-${known[3]}-${known[4]}`, date: `${known[2]}-${known[3]}-${known[4]}`, sessionId: known[5] ?? null };
    }
    return null;
  }
  if (!/\.(?:srt|txt|vtt)$/i.test(name) || !/_Captions_/i.test(name)) return null;
  const dm = name.match(/(\d{2})_(\d{2})_(\d{4})_Captions_/i);
  if (!dm) return null;
  const [m, d, y] = [+dm[1], +dm[2], +dm[3]];
  if (!validDate(y, m, d)) return null;
  for (const c of panopto) {
    const re = new RegExp(c.code.trim().split(/\s+/).join("[\\s_-]*"), "i");
    if (re.test(name)) {
      const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { code: c.code, slug: `${codeKey(c.code)}-${date}`, date, sessionId: null };
    }
  }
  return null;
}
