import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { getLesson } from "@/lib/data";

export default async function LessonPage({ params, searchParams }: PageProps<"/lesson/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const lesson = await getLesson(id);
  if (!lesson) notFound();
  return (
    <LessonPlayer
      lessonId={lesson.id}
      spec={lesson.spec}
      course={{ code: lesson.course.code, slug: lesson.course.slug, color: lesson.course.color }}
      initialStage={sp.stage === "flashcards" ? "flashcards" : undefined}
    />
  );
}
