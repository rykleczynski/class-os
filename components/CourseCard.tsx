"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, X } from "lucide-react";
import type { Course } from "@/lib/fixtures/courses";
import { courseStyle } from "@/lib/course-theme";
import { isDone, useProgress } from "@/lib/progress";
import { LessonList, type LessonItem } from "./LessonList";

export function CourseCard({ course, lessons }: { course: Course; lessons: LessonItem[] }) {
  const { ready, map } = useProgress();
  const [open, setOpen] = useState(false);
  const done = lessons.filter((l) => isDone(map[l.id])).length;
  const started = lessons.some((l) => map[l.id]);
  const total = lessons.length;
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
          <span className="tabular-nums" data-testid="card-count">{total === 0 ? "No lessons yet" : `${ready ? done : 0}/${total} lessons`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={ready ? done : 0} aria-label={`${course.code} progress`}>
          <div className="h-full rounded-full bg-(--course)" style={{ width: total && ready ? `${(done / total) * 100}%` : "0%" }} />
        </div>
        {total > 0 ? (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger className="relative z-10 mt-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              {started ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" aria-hidden />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
              <Dialog.Popup
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-soft outline-none transition-transform data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:p-6 md:data-[ending-style]:translate-y-[-48%] md:data-[ending-style]:opacity-0 md:data-[starting-style]:translate-y-[-48%] md:data-[starting-style]:opacity-0"
                style={courseStyle(course.slug)}
                data-testid="lesson-picker"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-(--course)">{course.code}</p>
                    <Dialog.Title className="mt-1 text-xl font-semibold tracking-tight">Which lesson do you want to begin with?</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-muted-foreground">{course.title}. Oldest lecture first.</Dialog.Description>
                  </div>
                  <Dialog.Close aria-label="Close" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border hover:border-control">
                    <X className="h-4 w-4" aria-hidden />
                  </Dialog.Close>
                </div>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                  <LessonList lessons={lessons} onNavigate={() => setOpen(false)} />
                </div>
                <Link href={`/course/${course.slug}`} onClick={() => setOpen(false)} className="mt-4 inline-flex min-h-10 w-fit items-center gap-1.5 text-sm font-semibold text-(--course) hover:underline">
                  View course <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ) : (
          <span className="mt-5 inline-flex min-h-10 items-center rounded-full bg-muted px-4 text-sm font-medium text-muted-foreground">Waiting for a recording</span>
        )}
      </div>
    </article>
  );
}
