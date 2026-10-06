import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { courseStyle } from "@/lib/course-theme";
import { getCourse, getLecturesForCourse, getLessonsForCourse, getTranscript, transcriptsPrivate } from "@/lib/data";

export default async function CoursePage({ params }: PageProps<"/course/[code]">) {
  const { code } = await params;
  const course = await getCourse(code);
  if (!course) notFound();
  const [lessons, lectures] = await Promise.all([getLessonsForCourse(course.id), getLecturesForCourse(course.id)]);
  const transcripts = await Promise.all(lectures.map(async (l) => ({ lecture: l, text: await getTranscript(l) })));

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-border bg-card p-6 shadow-soft" style={courseStyle(course.slug)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--course-soft) px-2.5 py-1 text-xs font-semibold text-(--course)">
            <span className="h-1.5 w-1.5 rounded-full bg-(--course)" aria-hidden />
            {course.category}
          </span>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{course.code}</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.instructor ? `${course.instructor} · ` : ""}
          {course.schedule} · {course.term}
        </p>
      </header>

      <section aria-label="Lessons" className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold tracking-tight">Lessons</h2>
        {lessons.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No lessons yet. They appear after the first recording is processed.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {lessons.map((l) => (
              <li key={l.id} className="py-3">
                <Link href={`/lesson/${l.id}`} className="font-semibold hover:underline">
                  {l.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {l.summary} · {l.est_minutes} min
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recordings" className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold tracking-tight">Recordings and transcripts</h2>
        {transcripts.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No recordings for this course yet.</p>}
        <ul className="mt-3 space-y-3">
          {transcripts.map(({ lecture, text }) => (
            <li key={lecture.id} className="rounded-2xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{new Date(lecture.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}</p>
                {lecture.wispr_share_link && (
                  <a href={lecture.wispr_share_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2">
                    Open in Wispr Flow <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {text ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Show transcript</summary>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs leading-relaxed">{text}</pre>
                </details>
              ) : transcriptsPrivate ? (
                <p className="mt-2 text-sm text-muted-foreground">Transcript stored privately. {lecture.wispr_share_link ? "Use the Wispr link above." : ""}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No transcript stored for this recording. Use the Wispr link.</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
