import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { guest_getLesson } from "@/lib/data";
import { guestProgressKey } from "@/lib/progress-keys";
import { openShare } from "@/lib/share/guest";

export default async function SharedLessonPage({ params, searchParams }: PageProps<"/s/[token]/lesson/[slug]">) {
  const { token, slug } = await params;
  const sp = await searchParams;
  const shared = await openShare(token);
  if (!shared) notFound();
  const { grant, course } = shared;
  // Scoped to the link's course: a slug from any other course is a 404.
  const lesson = await guest_getLesson(grant, slug);
  if (!lesson) notFound();
  return (
    <LessonPlayer
      lessonId={lesson.id}
      spec={lesson.spec}
      course={{ code: course.code, slug: course.slug, color: course.color }}
      initialStage={sp.stage === "flashcards" ? "flashcards" : undefined}
      guest={{ storageKey: guestProgressKey(course.slug), backHref: `/s/${token}` }}
    />
  );
}
