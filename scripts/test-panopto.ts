/**
 * Tests for Panopto caption pickup, the awaiting-panopto gate and sync-failure handling.
 * Usage: npm run test:panopto. No network: the gate runs against a fixed clock and a fake lectures file.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAuthError, isUnsynced, markSynced } from "./content-state";
import { fileCaptions } from "./materials";
import { captionTarget, srtToText } from "./panopto";

let failed = 0;
const ok = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!pass) failed++;
};

const SRT = `1
00:00:01,000 --> 00:00:04,500
Welcome back, today we cover
externalities.

2
00:00:04,500 --> 00:00:08,000
<i>The Pigouvian tax</i> is the first tool.
`;

// --- SRT conversion
const text = srtToText(SRT);
ok("srt: indices and timestamps removed", !/-->|^\d+$/m.test(text), JSON.stringify(text));
ok("srt: caption lines kept in order", text === "Welcome back, today we cover\nexternalities.\nThe Pigouvian tax is the first tool.\n");
ok("vtt: header and cue ids removed", srtToText("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello there\n") === "Hello there\n");
ok("srt: BOM and CRLF handled", srtToText("﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n") === "Hi\n");

// --- file name mapping
const cs = [{ code: "ECON 134", transcript_source: "panopto" as const }, { code: "ECON 106F" }];
const real = "26F-ECON134-1 Week 2 10_07_2026_Captions_English (United States).txt";
ok("name: real Panopto download maps to the slug", captionTarget(real, cs)?.slug === "econ134-2026-10-07");
ok("name: econ134-date.srt maps", captionTarget("econ134-2026-10-07.srt", cs)?.slug === "econ134-2026-10-07");
ok("name: session id suffix captured", captionTarget("econ134-2026-10-07__abc-123.srt", cs)?.sessionId === "abc-123");
ok("name: non-panopto course ignored", captionTarget("econ106f-2026-10-07.srt", cs) === null);
ok("name: impossible date ignored", captionTarget("econ134-2026-13-45.srt", cs) === null);
ok("name: unrelated txt ignored", captionTarget("notes.txt", cs) === null);

const tmp = mkdtempSync(join(tmpdir(), "classos-panopto-"));
const downloads = join(tmp, "Downloads");
const content = join(tmp, "content");
mkdirSync(downloads);
const put = (n: string, b: string) => writeFileSync(join(downloads, n), b);

// --- pickup
put(real, SRT);
put("26F-ECON134-1 Week 1 09_30_2026_Captions_English (United States).txt", "just notes, not captions");
put("econ134-2026-10-05.srt", SRT);
mkdirSync(join(content, "econ134-2026-10-05"), { recursive: true });
writeFileSync(join(content, "econ134-2026-10-05", "transcript.txt"), "already converted by hand\n");
const filed = fileCaptions(downloads, content, cs);
ok("pickup: Oct 7 transcript written", readFileSync(join(content, "econ134-2026-10-07", "transcript.txt"), "utf8") === text);
ok("pickup: existing transcript not overwritten", readFileSync(join(content, "econ134-2026-10-05", "transcript.txt"), "utf8") === "already converted by hand\n");
ok("pickup: non-caption file skipped", !existsSync(join(content, "econ134-2026-09-30")));
ok("pickup: only the new slug reported", filed.length === 1 && filed[0] === "econ134-2026-10-07", filed.join(","));
ok("pickup: real course config marks ECON 134 panopto", fileCaptions(downloads, join(tmp, "c2")).includes("econ134-2026-10-07"));

// --- gate
const gateContent = join(tmp, "gate");
mkdirSync(gateContent);
const lectures = join(tmp, "lectures.json");
writeFileSync(lectures, "[]");
const gate = (...extra: string[]) => {
  const r = spawnSync("node", ["--import", "tsx", join(__dirname, "pending.ts"), ...extra], {
    env: {
      ...process.env, CLASSOS_CONTENT_DIR: gateContent, CLASSOS_NOW: "2026-10-07T23:00:00Z",
      CLASSOS_TEST_LECTURES: lectures, CLASSOS_LOOKBACK_DAYS: "1", CLASSOS_MAX_SESSIONS: "50",
    },
    encoding: "utf8",
  });
  let sessions: { slug: string; source?: { sourceId: string; transcriptFile: string } }[] = [];
  try {
    sessions = JSON.parse(r.stdout).sessions;
  } catch {
    /* exit 3 prints nothing */
  }
  return { code: r.status, err: r.stderr, sessions };
};
const attemptsFile = join(gateContent, "_state", "attempts.json");
const attempts = () => (existsSync(attemptsFile) ? JSON.parse(readFileSync(attemptsFile, "utf8")) : {});

let g = gate("--record");
ok("gate: other courses still pending", g.sessions.some((s) => s.slug === "econ106f-2026-10-07"));
ok("gate: ECON 134 not handed out without captions", !g.sessions.some((s) => s.slug === "econ134-2026-10-07"));
ok("gate: reports awaiting-panopto", /awaiting-panopto econ134-2026-10-07/.test(g.err), g.err.trim());
ok("gate: no attempt spent on ECON 134", !("econ134-2026-10-07" in attempts()));
const logFile = join(gateContent, "_log");
const logged = () => (existsSync(logFile) ? readdirSync(logFile).map((f) => readFileSync(join(logFile, f), "utf8")).join("") : "");
ok("gate: awaiting-panopto logged once", (logged().match(/econ134-2026-10-07 awaiting-panopto/g) ?? []).length === 1);
gate();
ok("gate: still once after another tick", (logged().match(/econ134-2026-10-07 awaiting-panopto/g) ?? []).length === 1);

// only ECON 134 pending and no captions: nothing to do, exit 3 so claude never starts
writeFileSync(lectures, JSON.stringify([
  { code: "ECON 106F", start: Date.parse("2026-10-07T15:00:00Z"), hasLesson: true },
  { code: "COMM 187", start: Date.parse("2026-10-07T16:30:00Z"), hasLesson: true },
]));
g = gate();
ok("gate: awaiting-panopto alone exits 3", g.code === 3 && g.sessions.length === 0, `exit ${g.code}`);

// captions arrive
mkdirSync(join(gateContent, "econ134-2026-10-07"));
writeFileSync(join(gateContent, "econ134-2026-10-07", "transcript.txt"), text);
g = gate("--record");
const s134 = g.sessions.find((s) => s.slug === "econ134-2026-10-07");
ok("gate: handed out once captions exist", Boolean(s134));
ok("gate: source id falls back to panopto:<slug>", s134?.source?.sourceId === "panopto:econ134-2026-10-07");
ok("gate: attempt now counted", attempts()["econ134-2026-10-07"]?.count === 1);
writeFileSync(join(gateContent, "econ134-2026-10-07", "panopto.json"), JSON.stringify({ sessionId: "abc-123" }));
ok("gate: sidecar session id used", gate().sessions.find((s) => s.slug === "econ134-2026-10-07")?.source?.sourceId === "panopto:abc-123");

// --- generated but sync failed
writeFileSync(lectures, "[]");
const dir = join(gateContent, "econ106f-2026-10-07");
mkdirSync(dir);
writeFileSync(join(dir, "lesson.json"), "{}");
writeFileSync(join(dir, "meta.json"), "{}");
ok("sync: files without marker count as unsynced", isUnsynced(gateContent, "econ106f-2026-10-07"));
const before = attempts()["econ106f-2026-10-07"]?.count ?? 0;
g = gate("--record");
ok("gate: unsynced lesson is not handed to Claude", !g.sessions.some((s) => s.slug === "econ106f-2026-10-07"));
ok("gate: unsynced lesson reported", /econ106f-2026-10-07 generated, waiting for sync/.test(g.err));
ok("gate: unsynced lesson spends no attempt", (attempts()["econ106f-2026-10-07"]?.count ?? 0) === before);
markSynced(gateContent, "econ106f-2026-10-07");
ok("sync: marker clears unsynced", !isUnsynced(gateContent, "econ106f-2026-10-07"));
ok("auth: Invalid API key detected", isAuthError("course lookup: Invalid API key") && !isAuthError("lecture upsert: duplicate key"));

// --- give-up note states the real reason
writeFileSync(attemptsFile, JSON.stringify({ "comm187-2026-10-07": { count: 3, last: new Date().toISOString() } }));
writeFileSync(join(gateContent, "_log", "x.log"), "2026-10-07T20:00:00.000Z comm187-2026-10-07 failed 12s sync\n", { flag: "a" });
gate();
const note = join(gateContent, "_inbox", "comm187-2026-10-07.md");
const noteText = existsSync(note) ? readFileSync(note, "utf8") : "";
ok("inbox: note written", noteText.length > 0);
ok("inbox: names the failure, not a missing recording", /last generator run failed \(sync\)/.test(noteText) && !/no Wispr recording/i.test(noteText), noteText.split("\n").find((l) => l.startsWith("Reason")));

rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
