import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { CourseCard } from "@/components/CourseCard";
import { courseStyle } from "@/lib/course-theme";
import { getAllLessons, getCourses, getFlashcardCount, getLessonsForCourse } from "@/lib/data";

export default async function Dashboard() {
  const [courses, all, cards] = await Promise.all([getCourses(), getAllLessons(), getFlashcardCount()]);
  const perCourse = await Promise.all(courses.map(async (c) => ({ c, lessons: await getLessonsForCourse(c.id) })));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Fall 2026</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your classes</h1>
      </header>

      <section aria-label="Courses" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {perCourse.map(({ c, lessons }) => (
          <CourseCard key={c.id} course={c} lessonIds={lessons.map((l) => l.id)} firstLessonId={lessons[0]?.id} />
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
          <Link href="/lesson/econ106f-class3?stage=flashcards" className="mt-6 inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-coral px-4 text-sm font-semibold text-coral-foreground transition-opacity hover:opacity-90">
            Start review <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
