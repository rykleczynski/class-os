/**
 * Zero-token gate for the Mac generator. No LLM, no MCP, no secrets.
 *
 * Computes class sessions from lib/fixtures/courses.ts (meetings, America/Los_Angeles)
 * for the last 7 days that ended at least 10 minutes ago, drops holidays, per-course no_class_dates and sessions
 * that already have a lecture in Supabase (publishable key, read-only), and prints the
 * rest as JSON.
 *
 *   npm run pending [-- --record] [-- --no-inbox]
 *   npm run pending -- --retry <slug>   # clear the inbox note and reset attempts and the 48h clock
 *   npm run pending -- --retry <slug> --regenerate
 *       # also rebuild a published lesson that is flagged materials_missing (only while the flag is still set)
 *
 * Exit codes: 0 = pending sessions printed, 3 = nothing to do, 4 = could not check
 * (offline or Supabase error; run.sh treats this as "try again next tick").
 *
 * Retry limits (content/_state/attempts.json): a session is given up on after 3
 * attempts or once it is more than 48h old. Giving up writes content/_inbox/<slug>.md
 * ("needs a manual source") and the session stops being pending. --record bumps the
 * attempt counter for every pending session (run.sh passes it right before claude runs).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { courses, courseByCode } from "../lib/fixtures/courses";
import { TERM_END, TERM_START, TZ, classSessions, codeKey, laDateString } from "../lib/schedule";
import { isUnsynced, panoptoState } from "./content-state";

/** Override with CLASSOS_LOOKBACK_DAYS (dry runs). */
const LOOKBACK_DAYS = Number(process.env.CLASSOS_LOOKBACK_DAYS ?? 7);
const MIN_AGE_MIN = 10;
const MAX_ATTEMPTS = 3;
const MAX_AGE_HOURS = 48;
/** At most this many sessions per claude run; --record only spends attempts on the ones emitted. */
const MAX_PER_RUN = Number(process.env.CLASSOS_MAX_SESSIONS ?? 2);

/** CLASSOS_CONTENT_DIR and CLASSOS_NOW exist for tests. */
const contentRoot = process.env.CLASSOS_CONTENT_DIR || join(__dirname, "..", "content");
const stateFile = join(contentRoot, "_state", "attempts.json");
const inboxDir = join(contentRoot, "_inbox");

const args = process.argv.slice(2);
const record = args.includes("--record");
const writeInbox = !args.includes("--no-inbox");
const retryIdx = args.indexOf("--retry");
const retrySlug = retryIdx >= 0 ? args[retryIdx + 1] : undefined;

type Session = {
  slug: string;
  courseCode: string;
  courseTitle: string;
  seriesIds: string[];
  date: string;
  startsAt: string;
  endsAt: string;
  attempts: number;
  /** Set for transcript_source "panopto" courses: the caption text is already in content/<slug>/transcript.txt. */
  source?: { type: "panopto"; transcriptFile: string; sourceId: string };
  /** Set by --regenerate: a lesson exists, but it was flagged materials_missing and should be rebuilt. */
  regenerate?: boolean;
};

const computeSessions = (now: number): Session[] =>
  classSessions(courses, now, LOOKBACK_DAYS, MIN_AGE_MIN).map((x) => ({ ...x, attempts: 0 }));

const lockDir = join(contentRoot, "_state", "attempts.lock");

/** Serializes read-modify-write of attempts.json between the gate and --retry. Waits up to 10s; a lock older than 60s is stale. */
function lockAttempts(): void {
  mkdirSync(join(contentRoot, "_state"), { recursive: true });
  for (let i = 0; i < 100; i++) {
    try {
      mkdirSync(lockDir);
      process.on("exit", () => rmSync(lockDir, { recursive: true, force: true }));
      return;
    } catch {
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > 60_000) rmSync(lockDir, { recursive: true, force: true });
      } catch {
        /* released between the two calls; try again */
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  console.error("pending: could not lock attempts.json");
  process.exit(4);
}

type Attempts = Record<string, { count: number; last: string; retryAt?: string; regenerate?: boolean }>;

function readAttempts(): Attempts {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
}

function retry(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error("pending: --retry needs a session slug such as econ106f-2026-10-07");
    process.exit(2);
  }
  lockAttempts();
  const attempts = readAttempts();
  const now = new Date().toISOString();
  attempts[slug] = { count: 0, last: now, retryAt: now, ...(args.includes("--regenerate") ? { regenerate: true } : {}) };
  mkdirSync(join(contentRoot, "_state"), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(attempts, null, 2));
  rmSync(join(inboxDir, `${slug}.md`), { force: true });
  console.error(`pending: ${slug} reset (attempts 0, 48h clock restarted); it must still be inside the lookback window`);
}

/** True while the published lesson still has materials_missing set. Exits 4 on a query error (for example migration 0002 not applied). */
async function stillFlagged(db: SupabaseClient, slug: string): Promise<boolean> {
  const { data, error } = await db.from("lessons").select("materials_missing").eq("slug", slug).maybeSingle();
  if (error) {
    console.error(`pending: materials_missing check failed: ${error.message}`);
    process.exit(4);
  }
  return Boolean((data as { materials_missing?: string | null } | null)?.materials_missing);
}

const logDay = (ms: number) => laDateString(ms);

/** The most recent log line for a slug, from content/_log. Used to say why a session was given up on. */
function lastLogged(slug: string): { outcome: string; note: string } | null {
  const dir = join(contentRoot, "_log");
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".log")).sort().reverse()) {
    const lines = readFileSync(join(dir, f), "utf8").split("\n").reverse();
    for (const line of lines) {
      const [, sl, outcome, , ...note] = line.split(" ");
      if (sl === slug && outcome) return { outcome, note: note.join(" ") };
    }
  }
  return null;
}

/** One awaiting-panopto log line per slug per day, so the 30 minute ticks do not flood the log. */
function logAwaitingPanopto(slug: string) {
  const dir = join(contentRoot, "_log");
  const file = join(dir, `${logDay(Date.now())}.log`);
  try {
    if (existsSync(file) && readFileSync(file, "utf8").split("\n").some((l) => l.includes(` ${slug} awaiting-panopto `))) return;
    mkdirSync(dir, { recursive: true });
    appendFileSync(file, `${new Date().toISOString()} ${slug} awaiting-panopto 0s\n`);
  } catch {
    /* logging is best effort */
  }
}

/** Inbox note text that states the real reason, not a guess. */
function giveUpNote(s: Pick<Session, "slug" | "courseCode" | "date" | "startsAt" | "endsAt" | "source">, why: string, last = lastLogged(s.slug)): string {
  let reason: string;
  let next: string;
  if (s.source) {
    reason = `The Panopto captions are in place, but no lesson was produced${last?.outcome === "failed" ? ` (last run: failed${last.note ? `, ${last.note}` : ""})` : ""}.`;
    next = "Check ~/Library/Logs/class-os-generator.log, then retry.";
  } else if (last?.outcome === "no-recording") {
    reason = "The generator found no Wispr recording for this session.";
    next = `Add a source by hand, for example the Panopto captions, then write content/${codeKey(s.courseCode)}-${s.date}/ following routine/PROMPT.md.`;
  } else if (last?.outcome === "failed") {
    reason = `The last generator run failed${last.note ? ` (${last.note})` : ""}.`;
    next = "Check ~/Library/Logs/class-os-generator.log for the cause.";
  } else {
    reason = `The generator never logged a result for this session (last log: ${last?.outcome ?? "none"}).`;
    next = "Check ~/Library/Logs/class-os-generator.log for the cause.";
  }
  return (
    `# ${s.courseCode} on ${s.date} needs attention\n\n` +
    `Session ${s.startsAt} to ${s.endsAt}. No lesson exists and the generator gave up (${why}).\n` +
    `Reason: ${reason}\n${next}\n` +
    `To try again, run: npm run pending -- --retry ${s.slug}\n` +
    `(deleting this file alone does not help: the attempt count and the 48h limit still apply).\n`
  );
}

async function main() {
  if (retryIdx >= 0) {
    retry(retrySlug ?? "");
    return;
  }
  const now = process.env.CLASSOS_NOW ? Date.parse(process.env.CLASSOS_NOW) : Date.now();
  // Outside the term the gate is idle no matter what is still unfinished, so Claude never starts during break.
  const today = laDateString(now);
  if (today < TERM_START || today > TERM_END) {
    console.log(`pending: outside term (${TERM_START} to ${TERM_END}), idle`);
    process.exit(3);
  }
  const testLecturesFile = process.env.CLASSOS_TEST_LECTURES; // tests: [{code,start,hasLesson}] instead of Supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!testLecturesFile && (!url || !key)) {
    console.error("pending: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set (.env.generator)");
    process.exit(4);
  }
  const sessions = computeSessions(now);
  let db: SupabaseClient | null = null;
  let lectures: { code: string | undefined; start: number; hasLesson: boolean }[];
  if (testLecturesFile) {
    lectures = JSON.parse(readFileSync(testLecturesFile, "utf8"));
  } else {
    db = createClient(url as string, key as string, { auth: { persistSession: false, autoRefreshToken: false } });
    const signal = AbortSignal.timeout(15_000);
    const { data, error } = await db
      .from("lectures")
      .select("starts_at, ends_at, courses(code), lessons(id)")
      .gte("starts_at", new Date(now - (LOOKBACK_DAYS + 2) * 86400_000).toISOString())
      .abortSignal(signal);
    if (error) {
      console.error(`pending: supabase check failed: ${error.message}`);
      process.exit(4);
    }
    lectures = (data ?? []).map((l) => {
      const c = l.courses as unknown as { code: string } | { code: string }[] | null;
      // The publishable key only sees published lessons, so a lecture row alone does not count as done.
      const hasLesson = Array.isArray(l.lessons) ? l.lessons.length > 0 : Boolean(l.lessons);
      return { code: Array.isArray(c) ? c[0]?.code : c?.code, start: Date.parse(l.starts_at as string), hasLesson };
    });
  }

  lockAttempts(); // held until exit so --record cannot overwrite a concurrent --retry
  const attempts = readAttempts();
  const pending: Session[] = [];
  const gaveUp: string[] = [];
  const awaitingSync: string[] = [];
  const awaitingPanopto: string[] = [];
  for (const s of sessions) {
    const sStart = Date.parse(s.startsAt);
    const sEnd = Date.parse(s.endsAt);
    const has = lectures.some((l) => l.code === s.courseCode && l.hasLesson && l.start >= sStart - 30 * 60_000 && l.start <= sEnd);
    if (has && !(attempts[s.slug]?.regenerate && db && (await stillFlagged(db, s.slug)))) continue;
    if (has) s.regenerate = true;
    // Generated on disk but the last sync failed: run.sh re-runs sync only. No Claude, no attempt spent.
    if (isUnsynced(contentRoot, s.slug)) {
      awaitingSync.push(s.slug);
      continue;
    }
    // Panopto courses (ECON 134) have no Wispr recording: wait for the caption file, spending nothing.
    let readyAt = 0;
    if (courseByCode(s.courseCode)?.transcript_source === "panopto") {
      const st = panoptoState(contentRoot, s.slug);
      if (!st.ready) {
        awaitingPanopto.push(s.slug);
        logAwaitingPanopto(s.slug);
        continue;
      }
      readyAt = st.mtimeMs; // the 48h clock starts when the captions arrive, not at class end
      s.source = { type: "panopto", transcriptFile: `content/${s.slug}/transcript.txt`, sourceId: `panopto:${st.sessionId ?? s.slug}` };
    }
    const inbox = join(inboxDir, `${s.slug}.md`);
    if (existsSync(inbox)) continue;
    s.attempts = attempts[s.slug]?.count ?? 0;
    const retryAt = attempts[s.slug]?.retryAt ? Date.parse(attempts[s.slug].retryAt as string) : 0;
    const ageH = (now - Math.max(sEnd, retryAt, readyAt)) / 3600_000;
    if (s.attempts >= MAX_ATTEMPTS || ageH > MAX_AGE_HOURS) {
      const why = s.attempts >= MAX_ATTEMPTS ? `${s.attempts} generator attempts` : `more than ${MAX_AGE_HOURS}h old`;
      // A regeneration that gives up keeps its published lesson, so no "needs a manual source" note (it would be wrong).
      if (writeInbox && !s.regenerate) {
        mkdirSync(inboxDir, { recursive: true });
        writeFileSync(
          inbox,
          giveUpNote(s, why),
        );
      }
      gaveUp.push(s.slug);
      continue;
    }
    pending.push(s);
  }

  if (awaitingSync.length) console.error(`pending: ${awaitingSync.join(", ")} generated, waiting for sync (no attempt spent)`);
  if (awaitingPanopto.length) console.error(`pending: awaiting-panopto ${awaitingPanopto.join(", ")} (no attempt spent): run /refresh-materials`);
  if (gaveUp.length) console.error(`pending: gave up on ${gaveUp.join(", ")} (inbox note ${writeInbox ? "written where no lesson exists" : "skipped"})`);
  if (!pending.length) process.exit(3);
  pending.splice(MAX_PER_RUN); // oldest first; the rest wait for the next tick

  if (record) {
    mkdirSync(join(contentRoot, "_state"), { recursive: true });
    for (const s of pending) {
      attempts[s.slug] = { ...attempts[s.slug], count: s.attempts + 1, last: new Date(now).toISOString() };
    }
    writeFileSync(stateFile, JSON.stringify(attempts, null, 2));
  }
  console.log(JSON.stringify({ generatedAt: new Date(now).toISOString(), timezone: TZ, sessions: pending }, null, 2));
  process.exit(0);
}

void main();
