import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeworkPlayer } from "@/components/homework/HomeworkPlayer";
import { UnlockForm } from "@/components/homework/UnlockForm";
import { fetchHomework } from "@/lib/homework";
import { HOMEWORK_SLUG, readHomeworkPasscode } from "@/lib/homework-cookie";

// The title stays generic: the set's title is only shown after the passcode is accepted.
export const metadata: Metadata = {
  title: "Homework",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * Passcode-gated study page. Outside (dash) on purpose, like the lesson player: it is a
 * single focused column, and the dashboard layout would query Supabase for the sidebar
 * even while the page is locked.
 */
export default async function HomeworkPage({ params }: PageProps<"/homework/[slug]">) {
  const { slug } = await params;
  if (!HOMEWORK_SLUG.test(slug)) notFound();
  const res = await fetchHomework(slug, await readHomeworkPasscode(slug));

  if (res.ok) {
    const { set } = res;
    return (
      <HomeworkPlayer
        slug={set.slug}
        title={set.title}
        dueAt={set.due_at}
        courseCode={set.course_code}
        courseSlug={set.course_slug}
        spec={set.spec}
        answers={set.answers}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        {res.reason === "locked" ? (
          <UnlockForm slug={slug} />
        ) : (
          <Note>
            {res.reason === "disabled"
              ? "Homework pages need Supabase. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; fixtures mode has no homework."
              : res.reason === "invalid-spec"
                ? "This homework set is stored in a shape the page cannot read. Re-run npm run homework:sync."
                : "Could not load this page. Try again in a moment."}
          </Note>
        )}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="rounded-3xl border border-border bg-card p-6 shadow-soft" data-testid="homework-note">
      <h1 className="text-lg font-semibold tracking-tight">Homework</h1>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
