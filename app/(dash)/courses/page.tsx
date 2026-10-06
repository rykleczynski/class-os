import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { courseStyle } from "@/lib/course-theme";
import { getAllLessons, getCourses, getUpcomingAssessments } from "@/lib/data";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function CoursesPage() {
  const [courses, lessons, assessments] = await Promise.all([getCourses(), getAllLessons(), getUpcomingAssessments()]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Fall 2026</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Courses</h1>
      </header>

      <section aria-label="Courses" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => {
          const count = lessons.filter((l) => l.course_id === c.id).length;
          const next = assessments.find((a) => a.course_id === c.id);
          return (
            <article
              key={c.id}
              className="relative flex min-h-48 flex-col justify-between gap-5 rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-control"
              style={courseStyle(c.slug)}
              data-testid="course-card"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-(--course-soft) px-2.5 py-1 text-xs font-semibold text-(--course)">
                    <span className="h-1.5 w-1.5 rounded-full bg-(--course)" aria-hidden />
                    {c.category}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{c.code}</span>
                </div>
                <h2 className="mt-4 text-lg font-semibold leading-snug tracking-tight">
                  <Link href={`/course/${c.slug}`} className="after:absolute after:inset-0 after:rounded-3xl hover:underline hover:underline-offset-4">
                    {c.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.instructor ? `${c.instructor} · ` : ""}
                  {c.schedule}
                </p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium tabular-nums" data-testid="lesson-count">
                  {count === 0 ? "No lessons yet" : `${count} ${count === 1 ? "lesson" : "lessons"}`}
                </p>
                {next && (
                  <p className="text-muted-foreground">
                    Next: {next.title}
                    {next.due_at ? ` · ${dateFmt.format(new Date(next.due_at))}` : ""}
                  </p>
                )}
                <span className="inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-(--course)">
                  Open course <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
