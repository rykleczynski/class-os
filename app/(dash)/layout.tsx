import { AppSidebar } from "@/components/AppSidebar";
import { getLatestLessonSlug } from "@/lib/data";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const latestLesson = await getLatestLessonSlug();
  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar latestLesson={latestLesson} />
      <div className="md:pl-56">
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-10">{children}</main>
      </div>
    </div>
  );
}
