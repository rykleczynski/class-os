import Link from "next/link";
import { ArrowRight, CalendarClock, Layers } from "lucide-react";
import { CourseCard } from "@/components/CourseCard";
import { courseStyle } from "@/lib/course-theme";
import { getAllLessons, getCourses, getFlashcardCount, getLessonTimeline, getUpcomingReviews } from "@/lib/data";

export default async function Dashboard() {
  const [courses, all, cards, timeline, exams] = await Promise.all([getCourses(), getAllLessons(), getFlashcardCount(), getLessonTimeline(), getUpcomingReviews()]);
  const latest = timeline.at(-1)?.id;
  const perCourse = courses.map((c) => ({ c, lessons: timeline.filter((l) => l.course_id === c.id) }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Fall 2026</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your classes</h1>
      </header>

      {exams.length > 0 && (
        <section aria-label="Upcoming exams" className="grid gap-3 sm:grid-cols-2">
          {exams.map((r) => (
            <Link
              key={r.slug}
              href={`/review/${r.slug}`}
              style={courseStyle(r.course.slug)}
              className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-ink-foreground transition-opacity hover:opacity-95"
              data-testid="exam-card"
            >
              <CalendarClock className="h-6 w-6 shrink-0 text-coral" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {r.course.code}
                  {r.exam_at ? ` · ${new Date(r.exam_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}` : ""}
                </span>
                <span className="mt-0.5 block font-semibold">{r.exam_title}: open the review</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          ))}
        </section>
      )}

      <section aria-label="Courses"className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {perCourse.map(({ c, lessons }) => (
          <CourseCard key={c.id} course={c} lessons={lessons} />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Up next" className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold tracking-tight">Up next</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Lesson</th>
                  <th className="pb-2 font-medium">Course</th>
                  <th className="pb-2 text-right font-medium">Min</th>
                </tr>
              </thead>
              <tbody>
                {all.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-3 pr-3 font-medium">
                      <Link href={`/lesson/${l.id}`} className="hover:underline">
                        {l.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground" style={courseStyle(l.course.slug)}>
                        <span className="h-2 w-2 rounded-full bg-(--course)" aria-hidden />
                        {l.course.code}
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums">{l.est_minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside aria-label="Review" className="flex flex-col justify-between rounded-3xl bg-ink p-6 text-ink-foreground">
          <div>
            <Layers className="h-6 w-6 text-coral" strokeWidth={1.75} aria-hidden />
            <h2 className="mt-4 text-lg font-semibold tracking-tight">Review</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {cards} flashcards from your lessons. Weak spots from missed questions will show up here once attempts are saved.
            </p>
          </div>
          {latest && (
            <Link href={`/lesson/${latest}?stage=flashcards`} className="mt-6 inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-coral px-4 text-sm font-semibold text-coral-foreground transition-opacity hover:opacity-90">
              Start review <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
