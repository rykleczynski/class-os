import { notFound } from "next/navigation";
import { LessonList } from "@/components/LessonList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { courseStyle } from "@/lib/course-theme";
import { guest_getView } from "@/lib/data";
import { guestProgressKey } from "@/lib/progress-keys";
import { openShare } from "@/lib/share/guest";

/**
 * Guest landing: one course header and its lessons. No sidebar, no recordings, no transcripts, no
 * Wispr links, no assessments, no materials notes, and nothing about any other course.
 */
export default async function SharedCoursePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const shared = await openShare(token, { touch: true });
  if (!shared) notFound();
  const { grant, course } = shared;
  const lessons = await guest_getView(grant);

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-soft" style={courseStyle(course.slug)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-(--course-soft) px-2.5 py-1 text-xs font-semibold text-(--course)">
                <span className="h-1.5 w-1.5 rounded-full bg-(--course)" aria-hidden />
                {course.category}
              </span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{course.code}</span>
            </div>
            <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {course.instructor ? `${course.instructor} · ` : ""}
            {course.term}
          </p>
        </header>

        <section aria-label="Lessons" className="rounded-3xl border border-border bg-card p-5 shadow-soft" style={courseStyle(course.slug)}>
          <h2 className="text-lg font-semibold tracking-tight">Lessons</h2>
          {lessons.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No lessons yet. Check back after the next class.</p>
          ) : (
            <div className="mt-3">
              <LessonList lessons={lessons} basePath={`/s/${token}/lesson`} storageKey={guestProgressKey(course.slug)} />
            </div>
          )}
        </section>
        <p className="text-center text-xs text-muted-foreground">Your progress is saved in this browser only.</p>
      </main>
    </div>
  );
}
