import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { courses, courseBySlug, type Course } from "./fixtures/courses";
import econLesson from "./fixtures/lessons/econ106f-class3.json";
import commLesson from "./fixtures/lessons/comm187-class3.json";
import type { Lesson } from "./lesson/schema";

/**
 * Data access boundary. Pages call only these functions, so swapping the
 * fixture implementation for Supabase later means changing this file only.
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

const lectures: LectureRecord[] = [
  {
    id: "lec-econ106f-3",
    course_id: "c-econ106f",
    wispr_meeting_id: "2b8f0773-fb67-4389-9551-ff835a6b9f8a",
    starts_at: "2026-10-05T15:00:20Z",
    wispr_share_link: "https://notes.wisprflow.ai/shared/SGM_CQ-BnLpOzHMgAz0Apu9oKuvzE0FBAf7ObPjFKIU",
    transcript_file: "econ106f-class3.txt",
    status: "generated",
  },
  {
    id: "lec-comm187-3",
    course_id: "c-comm187",
    wispr_meeting_id: "9d6e4625-fd96-4a72-88a4-ddfb72888a8c",
    starts_at: "2026-10-05T16:30:47Z",
    wispr_share_link: "https://notes.wisprflow.ai/shared/hB4i6GY_ZHhvg8Uin8e82Uv2ak0P4VSUA6LPGPn0lKA",
    transcript_file: null,
    status: "generated",
  },
];

function record(id: string, lectureId: string, courseId: string, spec: Lesson, summary: string, created: string): LessonRecord {
  return {
    id,
    lecture_id: lectureId,
    course_id: courseId,
    title: spec.title,
    summary,
    est_minutes: spec.est_minutes,
    created_at: created,
    spec,
    schema_version: spec.schema_version,
  };
}

const lessons: LessonRecord[] = [
  record("econ106f-class3", "lec-econ106f-3", "c-econ106f", econLesson as Lesson, "Value vs price, the NPV decision rule, and the first look at time value of money.", "2026-10-05T16:20:00Z"),
  record("comm187-class3", "lec-comm187-3", "c-comm187", commLesson as Lesson, "Fairness, personal vs professional ethics, objectivity, and conflicts of interest.", "2026-10-05T18:00:00Z"),
];

export async function getCourses(): Promise<Course[]> {
  return courses;
}

export async function getCourse(slug: string): Promise<Course | undefined> {
  return courseBySlug(slug);
}

export async function getLessonsForCourse(courseId: string): Promise<LessonRecord[]> {
  return lessons.filter((l) => l.course_id === courseId);
}

export async function getLesson(id: string): Promise<(LessonRecord & { course: Course }) | undefined> {
  const l = lessons.find((x) => x.id === id);
  const course = l && courses.find((c) => c.id === l.course_id);
  return l && course ? { ...l, course } : undefined;
}

export async function getAllLessons(): Promise<Array<LessonRecord & { course: Course }>> {
  return lessons.flatMap((l) => {
    const course = courses.find((c) => c.id === l.course_id);
    return course ? [{ ...l, course }] : [];
  });
}

export async function getLecturesForCourse(courseId: string): Promise<LectureRecord[]> {
  return lectures.filter((l) => l.course_id === courseId);
}

export async function getTranscript(lecture: LectureRecord): Promise<string | null> {
  if (!lecture.transcript_file) return null;
  try {
    return await readFile(join(process.cwd(), "lib", "fixtures", "transcripts", lecture.transcript_file), "utf8");
  } catch {
    return null;
  }
}

export async function getFlashcardCount(): Promise<number> {
  return lessons.reduce((n, l) => n + ((l.spec as Lesson).flashcards?.length ?? 0), 0);
}
