/**
 * Zero-token gate for the Mac generator. No LLM, no MCP, no secrets.
 *
 * Computes class sessions from lib/fixtures/courses.ts (meetings, America/Los_Angeles)
 * for the last 7 days that ended at least 10 minutes ago, drops holidays, per-course no_class_dates and sessions
 * that already have a lecture in Supabase (publishable key, read-only), and prints the
 * rest as JSON.
 *
 *   npm run pending [-- --record] [-- --no-inbox]
 *
 * Exit codes: 0 = pending sessions printed, 3 = nothing to do, 4 = could not check
 * (offline or Supabase error; run.sh treats this as "try again next tick").
 *
 * Retry limits (content/_state/attempts.json): a session is given up on after 3
 * attempts or once it is more than 48h old. Giving up writes content/_inbox/<slug>.md
 * ("needs a manual source") and the session stops being pending. --record bumps the
 * attempt counter for every pending session (run.sh passes it right before claude runs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { courses } from "../lib/fixtures/courses";

const TZ = "America/Los_Angeles";
/** Override with CLASSOS_LOOKBACK_DAYS (dry runs). */
const LOOKBACK_DAYS = Number(process.env.CLASSOS_LOOKBACK_DAYS ?? 7);
const MIN_AGE_MIN = 10;
const MAX_ATTEMPTS = 3;
const MAX_AGE_HOURS = 48;
/** MM-DD, local date. Add to this list as the term goes on. */
const HOLIDAYS = new Set(["11-11", "11-26", "11-27"]);

const contentRoot = join(__dirname, "..", "content");
const stateFile = join(contentRoot, "_state", "attempts.json");
const inboxDir = join(contentRoot, "_inbox");

const args = process.argv.slice(2);
const record = args.includes("--record");
const writeInbox = !args.includes("--no-inbox");

type Session = {
  slug: string;
  courseCode: string;
  courseTitle: string;
  seriesIds: string[];
  date: string;
  startsAt: string;
  endsAt: string;
  attempts: number;
};

const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDate(ms: number): { y: number; m: number; d: number; wd: number } {
  const p = Object.fromEntries(dtf.formatToParts(ms).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, wd: WEEKDAYS.indexOf(p.weekday) };
}

/** UTC ms for a wall-clock time in America/Los_Angeles (handles DST). */
function laToUtc(y: number, m: number, d: number, hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  for (const off of [7, 8]) {
    const t = guess + off * 3600_000;
    const l = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(t);
    const g = Object.fromEntries(l.map((x) => [x.type, x.value]));
    if (+g.year === y && +g.month === m && +g.day === d && +g.hour % 24 === hh && +g.minute === mm) return t;
  }
  return guess + 8 * 3600_000;
}

const pad = (n: number) => String(n).padStart(2, "0");
const codeKey = (code: string) => code.toLowerCase().replace(/\s+/g, "");

function computeSessions(now: number): Session[] {
  const out: Session[] = [];
  const seen = new Set<string>();
  for (let back = 0; back <= LOOKBACK_DAYS + 1; back++) {
    const { y, m, d, wd } = localDate(now - back * 86400_000);
    const date = `${y}-${pad(m)}-${pad(d)}`;
    if (HOLIDAYS.has(`${pad(m)}-${pad(d)}`)) continue;
    for (const c of courses) {
      if (c.no_class_dates?.includes(date)) continue;
      for (const mt of c.meetings) {
        if (!mt.days.includes(wd)) continue;
        const start = laToUtc(y, m, d, mt.start);
        const end = laToUtc(y, m, d, mt.end);
        if (end > now - MIN_AGE_MIN * 60_000) continue;
        if (end < now - LOOKBACK_DAYS * 86400_000) continue;
        const slug = `${codeKey(c.code)}-${date}`;
        if (seen.has(slug)) continue;
        seen.add(slug);
        out.push({
          slug, courseCode: c.code, courseTitle: c.title, seriesIds: c.calendar_event_series_ids, date,
          startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), attempts: 0,
        });
      }
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function readAttempts(): Record<string, { count: number; last: string }> {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const now = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("pending: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set (.env.generator)");
    process.exit(4);
  }
  const sessions = computeSessions(now);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const signal = AbortSignal.timeout(15_000);
  const { data, error } = await db
    .from("lectures")
    .select("starts_at, ends_at, courses(code)")
    .gte("starts_at", new Date(now - (LOOKBACK_DAYS + 2) * 86400_000).toISOString())
    .abortSignal(signal);
  if (error) {
    console.error(`pending: supabase check failed: ${error.message}`);
    process.exit(4);
  }
  const lectures = (data ?? []).map((l) => {
    const c = l.courses as unknown as { code: string } | { code: string }[] | null;
    return { code: Array.isArray(c) ? c[0]?.code : c?.code, start: Date.parse(l.starts_at as string) };
  });

  const attempts = readAttempts();
  const pending: Session[] = [];
  const gaveUp: string[] = [];
  for (const s of sessions) {
    const sStart = Date.parse(s.startsAt);
    const sEnd = Date.parse(s.endsAt);
    const has = lectures.some((l) => l.code === s.courseCode && l.start >= sStart - 30 * 60_000 && l.start <= sEnd);
    if (has) continue;
    const inbox = join(inboxDir, `${s.slug}.md`);
    if (existsSync(inbox)) continue;
    s.attempts = attempts[s.slug]?.count ?? 0;
    const ageH = (now - sEnd) / 3600_000;
    if (s.attempts >= MAX_ATTEMPTS || ageH > MAX_AGE_HOURS) {
      const why = s.attempts >= MAX_ATTEMPTS ? `${s.attempts} generator attempts` : `more than ${MAX_AGE_HOURS}h old`;
      if (writeInbox) {
        mkdirSync(inboxDir, { recursive: true });
        writeFileSync(
          inbox,
          `# ${s.courseCode} on ${s.date} needs a manual source\n\n` +
            `Session ${s.startsAt} to ${s.endsAt}. No lesson exists and the generator gave up (${why}).\n` +
            `Likely no Wispr recording. Add a source by hand, for example the Panopto captions, ` +
            `then write content/${codeKey(s.courseCode)}-${s.date}/ following routine/PROMPT.md.\n` +
            `Delete this file to make the gate consider the session again.\n`,
        );
      }
      gaveUp.push(s.slug);
      continue;
    }
    pending.push(s);
  }

  if (gaveUp.length) console.error(`pending: gave up on ${gaveUp.join(", ")} (inbox note ${writeInbox ? "written" : "skipped"})`);
  if (!pending.length) process.exit(3);

  if (record) {
    mkdirSync(join(contentRoot, "_state"), { recursive: true });
    for (const s of pending) {
      attempts[s.slug] = { count: s.attempts + 1, last: new Date(now).toISOString() };
    }
    writeFileSync(stateFile, JSON.stringify(attempts, null, 2));
  }
  console.log(JSON.stringify({ generatedAt: new Date(now).toISOString(), timezone: TZ, sessions: pending }, null, 2));
  process.exit(0);
}

void main();
