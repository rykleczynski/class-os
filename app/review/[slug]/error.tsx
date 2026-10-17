"use client";

import Link from "next/link";

export default function ReviewError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-8">
      <div role="alert" className="rounded-2xl border border-border bg-card p-6">
        <p className="text-lg font-extrabold">This review hit a snag.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong while loading it. Your checklist and practice answers are saved in this browser. Try again, or head back to the dashboard.
        </p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => retry()} className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
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
