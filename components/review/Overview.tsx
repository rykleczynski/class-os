"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Md } from "@/components/Md";
import type { Review } from "@/lib/review/schema";
import type { ReviewState } from "@/lib/review/progress";
import { Card, Meter, WeightBadge, fmtDate, readiness } from "./shared";

const SOURCE_LABEL = { syllabus: "Syllabus", lecture: "Lecture", announcement: "Announcement", "past-exam": "Past exam" } as const;

/** The current minute (ms), refreshed every minute. Null on the server so the first client render matches. */
function useMinute(): number | null {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 60_000);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}

/** Whole days until the exam. */
function useDaysLeft(startsAt: string | null): number | null {
  const now = useMinute();
  if (now === null || !startsAt) return null;
  return Math.ceil((Date.parse(startsAt) - now) / 86_400_000);
}

export function Overview({ review, state, onOpenSection, onStartPractice }: { review: Review; state: ReviewState; onOpenSection: (id: string) => void; onStartPractice: () => void }) {
  const { exam } = review;
  const days = useDaysLeft(exam.startsAt);
  const total = readiness(review, state);
  const when = exam.startsAt
    ? new Date(exam.startsAt).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })
    : "Date not announced";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-3xl bg-ink p-6 text-ink-foreground">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            <CalendarClock className="h-4 w-4" aria-hidden /> {when}
            {days !== null && days >= 0 && <span className="rounded-full bg-coral px-2 py-0.5 text-xs text-coral-foreground">{days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}</span>}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{exam.title}</h1>
          <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-ink-muted">
            {exam.format.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onStartPractice} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-coral px-4 text-sm font-semibold text-coral-foreground transition-opacity hover:opacity-90">
            Take the practice exam <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </section>

        <Card title="What it covers">
          <Md text={exam.scope.summary} className="text-[0.95rem] leading-relaxed" />
          <ol className="mt-4 space-y-2">
            {exam.scope.lectures.map((l) => (
              <li key={l.date} className="rounded-2xl border border-paper-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className="tabular-nums text-muted-foreground">{fmtDate(l.date)}</span> · {l.title}
                  </p>
                  {l.lessonSlug && (
                    <Link href={`/lesson/${l.lessonSlug}`} className="text-xs font-semibold underline underline-offset-2">
                      Open lesson
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{l.topics.join(" · ")}</p>
              </li>
            ))}
          </ol>
          {exam.scope.excluded.length > 0 && (
            <div className="mt-4 rounded-2xl bg-warn-soft p-3 text-sm">
              <p className="font-semibold text-warn">Not on this exam</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {exam.scope.excluded.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="How we know">
          <ul className="space-y-3">
            {exam.scope.evidence.map((e, i) => (
              <li key={i} className="text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {SOURCE_LABEL[e.source]}
                  {e.date ? `, ${fmtDate(e.date)}` : ""}
                </p>
                <blockquote className="mt-1 border-l-4 border-paper-border pl-3 italic">{e.quote}</blockquote>
                <p className="mt-1 text-muted-foreground">{e.meaning}</p>
              </li>
            ))}
          </ul>
          {exam.scope.gaps.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">Not used: {exam.scope.gaps.join(" ")}</p>
          )}
        </Card>

        <Card title="The big picture">
          <Md text={review.bigPicture} className="text-[0.95rem] leading-relaxed" />
          {review.connections.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Connections an exam question could combine</h3>
              <ul className="mt-2 space-y-2">
                {review.connections.map((c, i) => (
                  <li key={i} className="rounded-2xl border border-paper-border p-3 text-sm">
                    <Md text={c} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <aside className="space-y-6">
        <Card title="Readiness">
          <Meter label="Overall" done={total.done} total={total.total} />
          <ul className="mt-4 space-y-3">
            {review.sections.map((s) => {
              const r = readiness(review, state, s.id);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => onOpenSection(s.id)} className="w-full rounded-xl p-2 text-left transition-colors hover:bg-muted">
                    <span className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug">{s.title}</span>
                      <WeightBadge weight={s.weight} />
                    </span>
                    <Meter label="I can" done={r.done} total={r.total} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Study plan">
          <ol className="space-y-3">
            {review.studyPlan.map((p, i) => (
              <li key={i}>
                <p className="text-sm font-semibold">{p.when}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {p.tasks.map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Card>
        <p className="px-2 text-xs text-muted-foreground">
          Generated {new Date(review.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })} from the lecture transcripts and lessons in scope.
        </p>
      </aside>
    </div>
  );
}
