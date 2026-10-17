"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { courseStyle } from "@/lib/course-theme";
import { reviewSchema, type Review } from "@/lib/review/schema";
import { useReviewState } from "@/lib/review/progress";
import { useCountdown } from "@/lib/review/countdown";
import { Overview } from "./Overview";
import { TopicGuide } from "./TopicGuide";
import { PracticeExam } from "./PracticeExam";
import { NotesSheet } from "./NotesSheet";
import { ReviewCards } from "./ReviewCards";
import { TABS, type TabId } from "@/lib/review/tabs";

type Props = { spec: unknown; course: { code: string; slug: string }; initialTab?: TabId };

export function ReviewView({ spec, course, initialTab }: Props) {
  const parsed = reviewSchema.safeParse(spec);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return (
      <div className="mx-auto max-w-xl p-8">
        <div role="alert" className="rounded-2xl border border-bad bg-bad-soft p-4">
          <p className="font-bold text-bad">This review could not be loaded.</p>
          <p className="mt-1 font-mono text-xs">{first?.path.join(".")}: {first?.message}</p>
        </div>
      </div>
    );
  }
  return <Shell review={parsed.data} course={course} initialTab={initialTab} />;
}

function Shell({ review, course, initialTab }: { review: Review; course: Props["course"]; initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab ?? "overview");
  const [section, setSection] = useState(review.sections[0].id);
  const { state, update, persistent } = useReviewState(review.slug);
  const timer = useCountdown(review.practiceExam.minutes); // held here so switching tabs keeps the clock

  const go = (next: TabId, sectionId?: string) => {
    setTab(next);
    if (sectionId) setSection(sectionId);
    // Keep the tab in the URL so a reload or a shared bookmark lands on it, without a navigation.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh bg-paper text-foreground" style={courseStyle(course.slug)}>
      <header className="sticky top-0 z-30 border-b border-paper-border bg-paper/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/course/${course.slug}`} aria-label={`Back to ${course.code}`} className="flex h-10 w-10 items-center justify-center rounded-full border border-paper-border bg-paper-card transition-colors hover:border-control">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-(--course)">{course.code} · Exam review</p>
            <p className="truncate text-sm font-semibold">{review.title}</p>
          </div>
          <ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" />
        </div>
        <nav aria-label="Review sections" className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2" role="tablist">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => go(t.id)}
                  className={`min-h-9 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors ${
                    tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-6" role="tabpanel">
        {tab === "overview" && <Overview review={review} state={state} onOpenSection={(id) => go("topics", id)} onStartPractice={() => go("practice")} />}
        {tab === "topics" && <TopicGuide review={review} sectionId={section} onSection={setSection} state={state} update={update} />}
        {!persistent && (
          <p role="status" className="mb-4 rounded-2xl bg-warn-soft px-4 py-2.5 text-sm text-warn">
            This browser is not saving your progress. Ticks and answers will be lost when you reload.
          </p>
        )}
        {tab === "practice" && <PracticeExam review={review} state={state} update={update} timer={timer} />}
        {tab === "sheet" && <NotesSheet review={review} />}
        {tab === "cards" && <ReviewCards review={review} />}
      </main>
    </div>
  );
}
