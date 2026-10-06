"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Course } from "@/lib/fixtures/courses";
import { useCompletedIds } from "@/lib/progress";

export function CourseCard({ course, lessonIds, firstLessonId }: { course: Course; lessonIds: string[]; firstLessonId?: string }) {
  const completed = useCompletedIds();
  const done = lessonIds.filter((id) => completed.includes(id)).length;
  const total = lessonIds.length;
  const nextId = lessonIds.find((id) => !completed.includes(id)) ?? firstLessonId;
  const dark = course.tone === "dark";
  const text = dark ? "text-[#16181d]" : "text-white";
  const lime = course.color.toLowerCase() === "#9bd84e";
  return (
    <article
      className={`relative flex min-h-56 flex-col justify-between overflow-hidden rounded-3xl p-5 ${text}`}
      style={{ background: course.color }}
      data-testid="course-card"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${dark ? "bg-black/10" : "bg-white/20"}`}>{course.category}</span>
          <span className="text-xs font-semibold opacity-80">{course.code}</span>
        </div>
        <h2 className="mt-4 text-xl font-extrabold leading-tight">
          <Link href={`/course/${course.slug}`} className="after:absolute after:inset-0 hover:underline">
            {course.title}
          </Link>
        </h2>
        <p className="mt-1 text-sm opacity-80">
          {course.instructor ? `${course.instructor} · ` : ""}
          {course.schedule}
        </p>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-xs font-semibold">
          <span>{total === 0 ? "No lessons yet" : `${done}/${total} lessons`}</span>
        </div>
        <div className={`h-2 overflow-hidden rounded-full ${dark ? "bg-black/15" : "bg-white/25"}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${course.code} progress`}>
          <div className={`h-full rounded-full ${dark ? "bg-black/70" : "bg-white"}`} style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
        </div>
        {nextId ? (
          <Link
            href={`/lesson/${nextId}`}
            className={`relative z-10 mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${lime ? "bg-[#16181d] text-white" : "bg-lime text-lime-foreground"}`}
          >
            {done > 0 ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`mt-4 inline-block rounded-full px-4 py-2 text-sm font-semibold opacity-80 ${dark ? "bg-black/10" : "bg-white/15"}`}>Waiting for a recording</span>
        )}
      </div>
    </article>
  );
}
