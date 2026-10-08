/**
 * Class-session schedule math shared by the generator gate (scripts/pending.ts) and the course page.
 * Pure: no fs, no network. All wall-clock times are America/Los_Angeles.
 */
import type { Course } from "./fixtures/courses";

export const TZ = "America/Los_Angeles";
/** MM-DD, local date. Add to this list as the term goes on. */
export const HOLIDAYS = new Set(["11-11", "11-26", "11-27"]);
/**
 * Local YYYY-MM-DD, inclusive. Sessions outside this window are ignored, and the gate itself stays idle
 * on any day outside it (breaks). TERM_END is the day after the last final (ECON 106F, Mon Dec 7).
 */
export const TERM_START = "2026-09-28";
export const TERM_END = "2026-12-08";
/** Last day of instruction (Fri Dec 4). Finals week has no lectures, so no session is generated after this. */
export const CLASSES_END = "2026-12-04";

export type ClassSession = {
  slug: string;
  courseCode: string;
  courseTitle: string;
  seriesIds: string[];
  /** Local YYYY-MM-DD. */
  date: string;
  startsAt: string;
  endsAt: string;
};

const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localDate(ms: number): { y: number; m: number; d: number; wd: number } {
  const p = Object.fromEntries(dtf.formatToParts(ms).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, wd: WEEKDAYS.indexOf(p.weekday) };
}

/** UTC ms for a wall-clock time in America/Los_Angeles (handles DST). */
export function laToUtc(y: number, m: number, d: number, hhmm: string): number {
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
export const codeKey = (code: string) => code.toLowerCase().replace(/\s+/g, "");
/** Local YYYY-MM-DD for an instant. */
export const laDateString = (ms: number) => {
  const { y, m, d } = localDate(ms);
  return `${y}-${pad(m)}-${pad(d)}`;
};

/** Sessions that ended at least minAgeMin ago and within the last lookbackDays, oldest first. */
export function classSessions(
  courseList: Pick<Course, "code" | "title" | "meetings" | "no_class_dates" | "calendar_event_series_ids">[],
  now: number,
  lookbackDays: number,
  minAgeMin: number,
): ClassSession[] {
  const out: ClassSession[] = [];
  const seen = new Set<string>();
  for (let back = 0; back <= lookbackDays + 1; back++) {
    const { y, m, d, wd } = localDate(now - back * 86400_000);
    const date = `${y}-${pad(m)}-${pad(d)}`;
    if (HOLIDAYS.has(`${pad(m)}-${pad(d)}`)) continue;
    if (date < TERM_START || date > CLASSES_END) continue;
    for (const c of courseList) {
      if (c.no_class_dates?.includes(date)) continue;
      for (const mt of c.meetings) {
        if (!mt.days.includes(wd)) continue;
        const start = laToUtc(y, m, d, mt.start);
        const end = laToUtc(y, m, d, mt.end);
        if (end > now - minAgeMin * 60_000) continue;
        if (end < now - lookbackDays * 86400_000) continue;
        const slug = `${codeKey(c.code)}-${date}`;
        if (seen.has(slug)) continue;
        seen.add(slug);
        out.push({
          slug, courseCode: c.code, courseTitle: c.title, seriesIds: c.calendar_event_series_ids, date,
          startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
        });
      }
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Local dates (YYYY-MM-DD) of recent classes that have no lesson yet, for a course whose lectures need a manual
 * caption pickup. lessonDates are ISO instants of existing lessons' lectures.
 */
export function datesAwaitingLesson(
  course: Parameters<typeof classSessions>[0][number],
  lessonDates: string[],
  lookbackDays = 7,
): string[] {
  const have = new Set(lessonDates.map((d) => laDateString(Date.parse(d))));
  return classSessions([course], Date.now(), lookbackDays, 10).map((x) => x.date).filter((d) => !have.has(d));
}
