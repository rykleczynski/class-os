import { courses, type Course } from "../fixtures/courses";

/**
 * Whether a course may be shared. Decided from the fixture list (the DB has no such column),
 * so a course the fixtures do not know is refused. A course that opted out of materials is also
 * refused: its syllabus bars using the content outside class.
 */
export function shareDecision(course: { id?: string; code?: string }): { ok: true } | { ok: false; reason: string } {
  const known: Course | undefined = courses.find((c) => c.id === course.id || c.code === course.code);
  if (!known) return { ok: false, reason: "This course cannot be shared." };
  if (known.shareable === false) return { ok: false, reason: known.share_blocked_reason ?? "This course cannot be shared." };
  if (known.materials_allowed === false) return { ok: false, reason: `${known.code}'s syllabus prohibits sharing course content` };
  return { ok: true };
}
