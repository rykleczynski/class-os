"use client";

import Link from "next/link";

export default function LessonError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-8">
      <div role="alert" className="rounded-2xl border border-border bg-card p-6">
        <p className="text-lg font-extrabold">This lesson hit a snag.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong while loading it. Your progress is safe. Try again, or head back to the dashboard.
        </p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={reset} className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Try again
          </button>
          <Link href="/" className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
