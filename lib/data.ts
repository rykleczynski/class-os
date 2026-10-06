import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { courses, courseBySlug, courseByCode, type Course } from "./fixtures/courses";
import { manifest } from "./fixtures/manifest";
import { lessonsBySlug } from "./fixtures/lessons-index";
import { connection } from "next/server";
import type { Lesson } from "./lesson/schema";
import { getSupabase, supabaseEnabled } from "./supabase/client";
import type { Database } from "./supabase/types";

/**
 * Data access boundary. Pages call only these functions. When both
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set the
 * data comes from Supabase; otherwise it comes from the fixtures.
 */
export type LectureRecord = {
  id: string;
  course_id: string;
  wispr_meeting_id: string;
  starts_at: string;
  wispr_share_link: string | null;
  transcript_file: string | null;
  status: "pending" | "generated" | "failed" | "unmatched";
};

export type LessonRecord = {
  id: string;
  lecture_id: string;
  course_id: string;
  title: string;
  summary: string;
  est_minutes: number;
  created_at: string;
  /** Raw JSON. Validation happens in the renderer so a bad block degrades, not the page. */
  spec: unknown;
  schema_version: number;
};

/** Fixture mode serves the same lecture list that `npm run sync` pushes to Supabase. */
const fixtureEntries = manifest.flatMap((e) => {
  const course = courseByCode(e.courseCode);
  const spec = lessonsBySlug[e.slug];
  return course && spec ? [{ e, course, spec }] : [];
});

const lectures: LectureRecord[] = fixtureEntries.map(({ e, course }) => ({
  id: `lec-${e.slug}`,
  course_id: course.id,
  wispr_meeting_id: e.sourceId,
  starts_at: e.startsAt,
  wispr_share_link: e.wisprShareLink,
  transcript_file: e.transcriptFile,
  status: "generated",
}));

const lessons: LessonRecord[] = fixtureEntries
  .map(({ e, course, spec }) => ({
    id: e.slug,
    lecture_id: `lec-${e.slug}`,
    course_id: course.id,
    title: spec.title,
    summary: e.summary ?? spec.hook,
    est_minutes: spec.est_minutes,
    created_at: new Date(e.endsAt).toISOString(),
    spec,
    schema_version: spec.schema_version,
  }))
  .sort((a, b) => b.created_at.localeCompare(a.created_at));

async function fixture_getCourses(): Promise<Course[]> {
  return courses;
}

async function fixture_getCourse(slug: string): Promise<Course | undefined> {
  return courseBySlug(slug);
}

async function fixture_getLessonsForCourse(courseId: string): Promise<LessonRecord[]> {
  return lessons.filter((l) => l.course_id === courseId);
}

async function fixture_getLesson(id: string): Promise<(LessonRecord & { course: Course }) | undefined> {
  const l = lessons.find((x) => x.id === id);
  const course = l && courses.find((c) => c.id === l.course_id);
  return l && course ? { ...l, course } : undefined;
}

async function fixture_getAllLessons(): Promise<Array<LessonRecord & { course: Course }>> {
  return lessons.flatMap((l) => {
    const course = courses.find((c) => c.id === l.course_id);
    return course ? [{ ...l, course }] : [];
  });
}

async function fixture_getLecturesForCourse(courseId: string): Promise<LectureRecord[]> {
  return lectures.filter((l) => l.course_id === courseId);
}

async function fixture_getTranscript(lecture: LectureRecord): Promise<string | null> {
  if (!lecture.transcript_file) return null;
  try {
    return await readFile(join(process.cwd(), "lib", "fixtures", "transcripts", lecture.transcript_file), "utf8");
  } catch {
    return null;
  }
}

async function fixture_getFlashcardCount(): Promise<number> {
  return lessons.reduce((n, l) => n + ((l.spec as Lesson).flashcards?.length ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];

const toCourse = (r: CourseRow): Course => ({
  id: r.id,
  code: r.code,
  slug: r.slug,
  title: r.title,
  category: r.category,
  instructor: r.instructor,
  schedule: r.schedule,
  color: r.color,
  tone: r.tone === "dark" ? "dark" : "light",
  calendar_event_series_ids: r.calendar_event_series_ids,
  aliases: r.aliases,
  term: r.term,
  generation_notes: r.generation_notes ?? "",
});

/** Lesson id exposed to the app is the slug, so URLs stay readable. */
const toLesson = (r: LessonRow, courseId: string): LessonRecord => ({
  id: r.slug,
  lecture_id: r.lecture_id,
  course_id: courseId,
  title: r.title,
  summary: r.summary ?? "",
  est_minutes: r.est_minutes ?? 0,
  created_at: r.created_at,
  spec: r.spec,
  schema_version: r.schema_version,
});

function db() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase is not configured");
  return c;
}

async function sb_getCourses(): Promise<Course[]> {
  const { data, error } = await db().from("courses").select("*").order("created_at");
  if (error) throw new Error(`courses: ${error.message}`);
  return data.map(toCourse);
}

async function sb_getLessonRows(): Promise<Array<LessonRecord & { course: Course; starts_at: string | null }>> {
  const [courses, lessons, lectures] = await Promise.all([
    sb_getCourses(),
    db().from("lessons").select("*").eq("status", "published").order("created_at", { ascending: false }),
    db().from("lectures").select("id, course_id, starts_at"),
  ]);
  if (lessons.error) throw new Error(`lessons: ${lessons.error.message}`);
  if (lectures.error) throw new Error(`lectures: ${lectures.error.message}`);
  const lectureById = new Map(lectures.data.map((l) => [l.id, l]));
  return lessons.data.flatMap((r) => {
    const lecture = lectureById.get(r.lecture_id);
    const course = courses.find((c) => c.id === lecture?.course_id);
    return course ? [{ ...toLesson(r, course.id), course, starts_at: lecture?.starts_at ?? null }] : [];
  });
}

async function sb_getLecturesForCourse(courseId: string): Promise<LectureRecord[]> {
  const { data, error } = await db()
    .from("lectures")
    // Never select transcript here: anon has no column grant for it (see 0001_init.sql).
    .select("id, course_id, wispr_meeting_id, starts_at, wispr_share_link, status")
    .eq("course_id", courseId)
    .order("starts_at");
  if (error) throw new Error(`lectures: ${error.message}`);
  return data.map((l) => ({
    id: l.id,
    course_id: courseId,
    wispr_meeting_id: l.wispr_meeting_id,
    starts_at: l.starts_at ?? "",
    wispr_share_link: l.wispr_share_link,
    transcript_file: null,
    status: l.status as LectureRecord["status"],
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCourses(): Promise<Course[]> {
  if (!supabaseEnabled) return fixture_getCourses();
  await connection();
  return sb_getCourses();
}

export async function getCourse(slug: string): Promise<Course | undefined> {
  if (!supabaseEnabled) return fixture_getCourse(slug);
  return (await getCourses()).find((c) => c.slug === slug);
}

export async function getAllLessons(): Promise<Array<LessonRecord & { course: Course }>> {
  if (!supabaseEnabled) return fixture_getAllLessons();
  await connection();
  return sb_getLessonRows();
}

export async function getLessonsForCourse(courseId: string): Promise<LessonRecord[]> {
  if (!supabaseEnabled) return fixture_getLessonsForCourse(courseId);
  return (await getAllLessons()).filter((l) => l.course_id === courseId);
}

export async function getLesson(id: string): Promise<(LessonRecord & { course: Course }) | undefined> {
  if (!supabaseEnabled) return fixture_getLesson(id);
  return (await getAllLessons()).find((l) => l.id === id);
}

export async function getLecturesForCourse(courseId: string): Promise<LectureRecord[]> {
  if (!supabaseEnabled) return fixture_getLecturesForCourse(courseId);
  await connection();
  return sb_getLecturesForCourse(courseId);
}

/** True when transcripts are not served to the browser (Supabase mode). */
export const transcriptsPrivate = supabaseEnabled;

/**
 * Local transcript text, fixtures mode only. In Supabase mode transcripts are
 * private (anon cannot read the column), so this returns null and the page shows
 * the Wispr share link instead.
 */
export async function getTranscript(lecture: LectureRecord): Promise<string | null> {
  if (supabaseEnabled) return null;
  return fixture_getTranscript(lecture);
}

export async function getFlashcardCount(): Promise<number> {
  if (!supabaseEnabled) return fixture_getFlashcardCount();
  const all = await getAllLessons();
  return all.reduce((n, l) => n + ((l.spec as Lesson).flashcards?.length ?? 0), 0);
}

export type Assessment = {
  id: string;
  course_id: string;
  title: string;
  kind: string;
  due_at: string | null;
  weight: number | null;
};

/**
 * Assessments due from today on, soonest first. Fixtures mode has no assessments
 * data, so it returns []. Supabase mode reads the public `assessments` table.
 */
export async function getUpcomingAssessments(): Promise<Assessment[]> {
  if (!supabaseEnabled) return [];
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db()
    .from("assessments")
    .select("id, course_id, title, kind, due_at, weight")
    .gte("due_at", today)
    .order("due_at");
  if (error) throw new Error(`assessments: ${error.message}`);
  return data;
}

export type LessonSummary = {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  est_minutes: number;
  /** Lecture start (ISO), falling back to the lesson's created_at. */
  date: string;
  /** Number of teaching steps, before the quiz and flashcards. */
  steps: number;
};

/** Every published lesson in lecture order, oldest first. */
export async function getLessonTimeline(): Promise<LessonSummary[]> {
  let starts: Map<string, string | null>;
  let all: LessonRecord[];
  if (!supabaseEnabled) {
    all = lessons;
    starts = new Map(lectures.map((l) => [l.id, l.starts_at]));
  } else {
    await connection();
    const rows = await sb_getLessonRows();
    all = rows;
    starts = new Map(rows.map((l) => [l.lecture_id, l.starts_at]));
  }
  return all
    .map((l) => ({
      id: l.id,
      course_id: l.course_id,
      title: l.title,
      summary: l.summary,
      est_minutes: l.est_minutes,
      date: starts.get(l.lecture_id) || l.created_at,
      steps: (l.spec as { steps?: unknown[] } | null)?.steps?.length ?? 0,
    }))
    .sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
}

/**
 * Slug of the most recent lesson (lecture starts_at, then created_at). Null when
 * there are none. Used by the sidebar on every page, so in Supabase mode it reads
 * only slugs and dates, not lesson specs.
 */
export async function getLatestLessonSlug(): Promise<string | null> {
  if (!supabaseEnabled) return (await getLessonTimeline()).at(-1)?.id ?? null;
  await connection();
  const [lessonRows, lectureRows] = await Promise.all([
    db().from("lessons").select("slug, lecture_id, created_at").eq("status", "published"),
    db().from("lectures").select("id, starts_at"),
  ]);
  if (lessonRows.error) throw new Error(`lessons: ${lessonRows.error.message}`);
  if (lectureRows.error) throw new Error(`lectures: ${lectureRows.error.message}`);
  const starts = new Map(lectureRows.data.map((l) => [l.id, l.starts_at]));
  const when = (r: (typeof lessonRows.data)[number]) => Date.parse(starts.get(r.lecture_id) || r.created_at) || 0;
  return lessonRows.data.reduce<(typeof lessonRows.data)[number] | null>((best, r) => (best && when(best) >= when(r) ? best : r), null)?.slug ?? null;
}
