import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { CourseCard } from "@/components/CourseCard";
import { getAllLessons, getCourses, getFlashcardCount, getLessonsForCourse } from "@/lib/data";

export default async function Dashboard() {
  const [courses, all, cards] = await Promise.all([getCourses(), getAllLessons(), getFlashcardCount()]);
  const perCourse = await Promise.all(courses.map(async (c) => ({ c, lessons: await getLessonsForCourse(c.id) })));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-muted-foreground">Fall 2026</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Your classes</h1>
      </header>

      <section aria-label="Courses" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {perCourse.map(({ c, lessons }) => (
          <CourseCard key={c.id} course={c} lessonIds={lessons.map((l) => l.id)} firstLessonId={lessons[0]?.id} />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Up next" className="rounded-3xl bg-card p-5">
          <h2 className="text-lg font-extrabold">Up next</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">Lesson</th>
                  <th className="pb-2 font-semibold">Course</th>
                  <th className="pb-2 text-right font-semibold">Min</th>
                </tr>
              </thead>
              <tbody>
                {all.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-3 pr-3 font-semibold">
                      <Link href={`/lesson/${l.id}`} className="hover:underline">
                        {l.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.course.color }} />
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

        <aside aria-label="Review" className="flex flex-col justify-between rounded-3xl bg-lime p-5 text-lime-foreground">
          <div>
            <Layers className="h-6 w-6" aria-hidden />
            <h2 className="mt-3 text-lg font-extrabold">Review</h2>
            <p className="mt-1 text-sm">
              {cards} flashcards from your lessons. Weak spots from missed questions will show up here once attempts are saved.
            </p>
          </div>
          <Link href="/lesson/econ106f-class3?stage=flashcards" className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-[#16181d] px-4 py-2 text-sm font-bold text-white">
            Start review <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
