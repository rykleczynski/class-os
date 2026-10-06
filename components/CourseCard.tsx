"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Course } from "@/lib/fixtures/courses";
import { courseStyle } from "@/lib/course-theme";
import { useCompletedIds } from "@/lib/progress";

export function CourseCard({ course, lessonIds, firstLessonId }: { course: Course; lessonIds: string[]; firstLessonId?: string }) {
  const completed = useCompletedIds();
  const done = lessonIds.filter((id) => completed.includes(id)).length;
  const total = lessonIds.length;
  const nextId = lessonIds.find((id) => !completed.includes(id)) ?? firstLessonId;
  return (
    <article
      className="group relative flex min-h-56 flex-col justify-between gap-5 rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-control"
      style={courseStyle(course.slug)}
      data-testid="course-card"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--course-soft) px-2.5 py-1 text-xs font-semibold text-(--course)">
            <span className="h-1.5 w-1.5 rounded-full bg-(--course)" aria-hidden />
            {course.category}
          </span>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{course.code}</span>
        </div>
        <h2 className="mt-4 text-lg font-semibold leading-snug tracking-tight">
          <Link href={`/course/${course.slug}`} className="after:absolute after:inset-0 after:rounded-3xl hover:underline hover:underline-offset-4">
            {course.title}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.instructor ? `${course.instructor} · ` : ""}
          {course.schedule}
        </p>
      </div>
      <div>
        <div className="mb-2 flex justify-between text-xs font-medium text-muted-foreground">
          <span>Progress</span>
          <span className="tabular-nums">{total === 0 ? "No lessons yet" : `${done}/${total} lessons`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${course.code} progress`}>
          <div className="h-full rounded-full bg-(--course)" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
        </div>
        {nextId ? (
          <Link
            href={`/lesson/${nextId}`}
            className="relative z-10 mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {done > 0 ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span className="mt-5 inline-flex min-h-10 items-center rounded-full bg-muted px-4 text-sm font-medium text-muted-foreground">Waiting for a recording</span>
        )}
      </div>
    </article>
  );
}
