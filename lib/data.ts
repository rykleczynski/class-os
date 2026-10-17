import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { courses, courseBySlug, courseByCode, type Course } from "./fixtures/courses";
import { manifest } from "./fixtures/manifest";
import { lessonsBySlug } from "./fixtures/lessons-index";
import { connection } from "next/server";
import type { Lesson } from "./lesson/schema";
import { reviewsRoot } from "./review/paths";
import { reviewSchema } from "./review/schema";
import { requireOwner } from "./auth";
import { getAdmin } from "./supabase/admin";
import { supabaseEnabled } from "./supabase/client";
import type { Database } from "./supabase/types";
import type { ShareGrant } from "./share/service";

/**
 * Data access boundary. Pages call only these functions. When both
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set the
 * data comes from Supabase, read with the service role (SUPABASE_SECRET_KEY) because
 * migration 0004 removes every anon grant; otherwise it comes from the fixtures.
 *
 * Access control lives here, not in the pages: every owner function starts with
 * requireOwner(), and the guest_* functions at the bottom need a ShareGrant, which only a
 * validated share token produces. Layouts do not protect pages in Next, so do not rely on them.
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
  /** Chapter or topic whose slides were missing at generation time. Absent in fixtures. */
  materials_missing?: string | null;
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
  meetings: [], // fixture-only; scripts/pending.ts reads lib/fixtures/courses.ts
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
  materials_missing: r.materials_missing ?? null,
});

function db() {
  const c = getAdmin();
  if (!c) throw new Error("SUPABASE_SECRET_KEY is not set: content is read server-side with the service role");
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
    // Never select transcript here: nothing in the app reads it.
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
  await requireOwner();
  if (!supabaseEnabled) return fixture_getCourses();
  await connection();
  return sb_getCourses();
}

export async function getCourse(slug: string): Promise<Course | undefined> {
  await requireOwner();
  if (!supabaseEnabled) return fixture_getCourse(slug);
  return (await getCourses()).find((c) => c.slug === slug);
}

export async function getAllLessons(): Promise<Array<LessonRecord & { course: Course }>> {
  await requireOwner();
  if (!supabaseEnabled) return fixture_getAllLessons();
  await connection();
  return sb_getLessonRows();
}

export async function getLessonsForCourse(courseId: string): Promise<LessonRecord[]> {
  await requireOwner();
  if (!supabaseEnabled) return fixture_getLessonsForCourse(courseId);
  return (await getAllLessons()).filter((l) => l.course_id === courseId);
}

export async function getLesson(id: string): Promise<(LessonRecord & { course: Course }) | undefined> {
  await requireOwner();
  if (!supabaseEnabled) return fixture_getLesson(id);
  return (await getAllLessons()).find((l) => l.id === id);
}

export async function getLecturesForCourse(courseId: string): Promise<LectureRecord[]> {
  await requireOwner();
  if (!supabaseEnabled) return fixture_getLecturesForCourse(courseId);
  await connection();
  return sb_getLecturesForCourse(courseId);
}

/** True when transcripts are not served to the browser (Supabase mode). */
export const transcriptsPrivate = supabaseEnabled;

/**
 * Local transcript text, fixtures mode only. In Supabase mode the app never
 * selects the transcript column, so this returns null and the page shows
 * the Wispr share link instead.
 */
export async function getTranscript(lecture: LectureRecord): Promise<string | null> {
  await requireOwner();
  if (supabaseEnabled) return null;
  return fixture_getTranscript(lecture);
}

export async function getFlashcardCount(): Promise<number> {
  await requireOwner();
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
  await requireOwner();
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

/** A review as listed on the course page and dashboard. The full spec is only read by getReview. */
export type ReviewSummary = { slug: string; course_id: string; title: string; exam_title: string; exam_at: string | null; generated_at: string };
export type ReviewRecord = ReviewSummary & { course: Course; spec: unknown };

/** Fixtures mode reads content/reviews/<slug>/review.json from disk; only files that pass the schema are served. */
async function fixture_reviews(): Promise<ReviewRecord[]> {
  const root = reviewsRoot();
  let dirs: string[];
  try {
    dirs = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  const out: ReviewRecord[] = [];
  for (const slug of dirs) {
    try {
      const parsed = reviewSchema.safeParse(JSON.parse(await readFile(join(root, slug, "review.json"), "utf8")));
      const course = parsed.success ? courseByCode(parsed.data.courseCode) : undefined;
      if (!parsed.success || !course || parsed.data.slug !== slug) continue;
      const r = parsed.data;
      out.push({ slug, course_id: course.id, course, title: r.title, exam_title: r.exam.title, exam_at: r.exam.startsAt, generated_at: r.generatedAt, spec: r });
    } catch {
      /* no review.json yet (only sources/) or unreadable: skip */
    }
  }
  return out;
}

/** Exam time in ms; no date sorts last. Parsed, because fixtures keep offsets like -07:00 and Supabase returns UTC. */
const examTime = (r: ReviewSummary) => (r.exam_at ? Date.parse(r.exam_at) : Infinity);
const byExamDate = (a: ReviewSummary, b: ReviewSummary) => examTime(a) - examTime(b);

/** Every review for a course, soonest exam first. */
export async function getReviewsForCourse(courseId: string): Promise<ReviewSummary[]> {
  await requireOwner();
  if (!supabaseEnabled) return (await fixture_reviews()).filter((r) => r.course_id === courseId).sort(byExamDate);
  await connection();
  const { data, error } = await db()
    .from("reviews")
    .select("slug, course_id, title, exam_title, exam_at, generated_at")
    .eq("course_id", courseId)
    .order("exam_at");
  if (error) return reviewsUnavailable(error.message);
  return data;
}

/** For example migration 0006 not applied yet: the course page and dashboard must still load. */
function reviewsUnavailable(message: string): [] {
  console.error(`reviews: ${message}`);
  return [];
}

/** Reviews whose exam has not started yet (or has no date), soonest first. Used by the dashboard. */
export async function getUpcomingReviews(): Promise<Array<ReviewSummary & { course: Course }>> {
  await requireOwner();
  await connection(); // reads the clock
  const now = new Date().toISOString();
  let rows: Array<ReviewSummary & { course: Course }>;
  if (!supabaseEnabled) rows = await fixture_reviews();
  else {
    const [all, { data, error }] = await Promise.all([
      sb_getCourses(),
      db().from("reviews").select("slug, course_id, title, exam_title, exam_at, generated_at").or(`exam_at.is.null,exam_at.gte.${now}`),
    ]);
    if (error) return reviewsUnavailable(error.message);
    rows = data.flatMap((r) => {
      const course = all.find((c) => c.id === r.course_id);
      return course ? [{ ...r, course }] : [];
    });
  }
  return rows.filter((r) => examTime(r) >= Date.parse(now)).sort(byExamDate);
}

export async function getReview(slug: string): Promise<ReviewRecord | undefined> {
  await requireOwner();
  if (!supabaseEnabled) return (await fixture_reviews()).find((r) => r.slug === slug);
  await connection();
  const { data, error } = await db().from("reviews").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`reviews: ${error.message}`);
  if (!data) return undefined;
  const course = (await sb_getCourses()).find((c) => c.id === data.course_id);
  if (!course) return undefined;
  return {
    slug: data.slug,
    course_id: data.course_id,
    course,
    title: data.title,
    exam_title: data.exam_title,
    exam_at: data.exam_at,
    generated_at: data.generated_at,
    spec: data.spec,
  };
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
  /** Set when the generator found no slides for this lecture. Null or absent otherwise. */
  materials_missing?: string | null;
};

/** Every published lesson in lecture order, oldest first. */
export async function getLessonTimeline(): Promise<LessonSummary[]> {
  await requireOwner();
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
      materials_missing: l.materials_missing ?? null,
    }))
    .sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
}

/**
 * Slug of the most recent lesson (lecture starts_at, then created_at). Null when
 * there are none. Used by the sidebar on every page, so in Supabase mode it reads
 * only slugs and dates, not lesson specs.
 */
export async function getLatestLessonSlug(): Promise<string | null> {
  await requireOwner();
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

// ---------------------------------------------------------------------------
// Guest reads (share links). Each takes a ShareGrant from a validated token.
// ---------------------------------------------------------------------------

/** Course metadata for a share link's course. Used to validate a token; returns no lessons. */
export async function guest_findCourse(courseId: string): Promise<Course | undefined> {
  if (!supabaseEnabled) return courses.find((c) => c.id === courseId);
  await connection();
  const { data, error } = await db().from("courses").select("*").eq("id", courseId).maybeSingle();
  if (error) throw new Error(`courses: ${error.message}`);
  return data ? toCourse(data) : undefined;
}

/** What a guest may see about a lesson in the list: no materials notes, no lecture or recording data. */
export type GuestLessonItem = { id: string; title: string; summary: string; est_minutes: number; date: string; steps: number };

async function guestLessonRows(courseId: string): Promise<Array<LessonRecord & { date: string }>> {
  if (!supabaseEnabled) {
    const starts = new Map(lectures.map((l) => [l.id, l.starts_at]));
    return lessons.filter((l) => l.course_id === courseId).map((l) => ({ ...l, date: starts.get(l.lecture_id) || l.created_at }));
  }
  await connection();
  const lec = await db().from("lectures").select("id, starts_at").eq("course_id", courseId);
  if (lec.error) throw new Error(`lectures: ${lec.error.message}`);
  if (lec.data.length === 0) return [];
  const rows = await db().from("lessons").select("*").eq("status", "published").in("lecture_id", lec.data.map((l) => l.id));
  if (rows.error) throw new Error(`lessons: ${rows.error.message}`);
  const starts = new Map(lec.data.map((l) => [l.id, l.starts_at]));
  return rows.data.map((r) => ({ ...toLesson(r, courseId), date: starts.get(r.lecture_id) || r.created_at }));
}

export async function guest_getView(grant: ShareGrant): Promise<GuestLessonItem[]> {
  const rows = await guestLessonRows(grant.courseId);
  return rows
    .map((l) => ({
      id: l.id,
      title: l.title,
      summary: l.summary,
      est_minutes: l.est_minutes,
      date: l.date,
      steps: (l.spec as { steps?: unknown[] } | null)?.steps?.length ?? 0,
    }))
    .sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
}

/** One lesson of the granted course. A slug from any other course is not found. */
export async function guest_getLesson(grant: ShareGrant, slug: string): Promise<{ id: string; spec: unknown } | undefined> {
  const hit = (await guestLessonRows(grant.courseId)).find((l) => l.id === slug);
  return hit ? { id: hit.id, spec: hit.spec } : undefined;
}
