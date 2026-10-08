"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { isDone, useProgress, type LessonProgress } from "@/lib/progress";

export type LessonItem = {
  id: string;
  title: string;
  summary?: string;
  est_minutes: number;
  date: string;
  steps: number;
  materials_missing?: string | null;
};

type State = "new" | "progress" | "done";

const stateOf = (p?: LessonProgress): State => (isDone(p) ? "done" : p ? "progress" : "new");

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => (Number.isNaN(Date.parse(iso)) ? "" : dateFmt.format(new Date(iso)));

/** Per-lesson progress line: "Not started", "Step x of N" with a thin bar, or a check with the quiz score. */
export function LessonProgressLabel({ lesson, progress }: { lesson: LessonItem; progress?: LessonProgress }) {
  const state = stateOf(progress);
  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-good" data-testid="lesson-progress" data-state="done">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Completed{progress?.quizTotal ? ` · Quiz ${progress.quizScore ?? 0}/${progress.quizTotal}` : ""}
      </span>
    );
  }
  if (state === "progress" && progress) {
    const n = Math.max(lesson.steps, 1);
    const at = Math.min(progress.lastStep, n - 1) + 1;
    const past = progress.lastStep >= n ? (progress.lastStep === n ? "Quiz" : "Flashcards") : null;
    return (
      <span className="block w-full max-w-48 text-xs font-medium text-muted-foreground" data-testid="lesson-progress" data-state="progress">
        <span className="tabular-nums">{past ?? `Step ${at} of ${n}`}</span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${lesson.title} progress`} aria-valuemin={0} aria-valuemax={n} aria-valuenow={past ? n : at}>
          <span className="block h-full rounded-full bg-(--course,var(--coral))" style={{ width: `${((past ? n : at) / n) * 100}%` }} />
        </span>
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground" data-testid="lesson-progress" data-state="new">
      Not started
    </span>
  );
}

/**
 * Lessons in lecture order with progress states. Shared by the dashboard picker
 * and the course page. Progress is read after mount, so a skeleton shows until then.
 */
export function LessonList({ lessons, onNavigate }: { lessons: LessonItem[]; onNavigate?: () => void }) {
  const { ready, map } = useProgress();
  const upNext = ready ? lessons.find((l) => !isDone(map[l.id]))?.id : undefined;

  return (
    <ul className="divide-y divide-border" data-testid="lesson-list">
      {lessons.map((l) => {
        const p = map[l.id];
        const state = stateOf(p);
        const isNext = l.id === upNext;
        const verb = state === "done" ? "Review" : state === "progress" ? "Resume" : "Start";
        const href = state === "done" ? `/lesson/${l.id}?stage=flashcards` : `/lesson/${l.id}`;
        return (
          <li key={l.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${isNext ? "-mx-3 rounded-2xl bg-muted/60 px-3" : ""}`} data-testid="lesson-row" data-lesson-id={l.id} aria-current={isNext ? "step" : undefined}>
            <div className="min-w-0 flex-1 basis-56">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatDate(l.date)}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{l.est_minutes} min</span>
                {isNext && <span className="rounded-full bg-coral px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-coral-foreground">Up next</span>}
              </p>
              <p className="mt-0.5 font-semibold leading-snug">{l.title}</p>
              {l.summary && <p className="mt-0.5 text-sm text-muted-foreground">{l.summary}</p>}
              {l.materials_missing && (
                <p className="mt-1 text-xs text-muted-foreground/80" data-testid="materials-missing">
                  Slides for {l.materials_missing} weren&apos;t available. Run /refresh-materials, then the lesson can be regenerated.
                </p>
              )}
              <div className="mt-1.5 min-h-4">
                {ready ? <LessonProgressLabel lesson={l} progress={p} /> : <span className="block h-3 w-24 animate-pulse rounded-full bg-muted" data-testid="progress-skeleton" aria-hidden />}
              </div>
            </div>
            <Link
              href={href}
              onClick={onNavigate}
              aria-label={`${verb} ${l.title}`}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-90 ${state === "done" ? "border border-border bg-card" : "bg-primary text-primary-foreground"}`}
            >
              {verb} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
