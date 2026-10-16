"use client";

import { Printer } from "lucide-react";
import type { Review } from "@/lib/review/schema";

/** The allowed notes sheet, drafted. Prints one side per page. */
export function NotesSheet({ review }: { review: Review }) {
  const { notesSheet } = review;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notes sheet draft</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {notesSheet.allowance} Writing it yourself is half the studying: use this as the checklist of what earns a spot, then make it yours.
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
          <Printer className="h-4 w-4" aria-hidden /> Print
        </button>
      </header>
      {notesSheet.sides.map((side, i) => (
        <section key={i} aria-label={`Side ${i + 1}`} className="break-after-page rounded-3xl border border-paper-border bg-paper-card p-5 shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:hidden">Side {i + 1}</p>
          <div className="columns-1 gap-5 sm:columns-2 xl:columns-3 print:columns-3 print:gap-3">
            {side.map((b, j) => (
              <div key={j} className="mb-4 break-inside-avoid print:mb-2">
                <h2 className="border-b border-paper-border pb-0.5 text-sm font-bold print:text-[8pt]">{b.heading}</h2>
                <ul className="mt-1 space-y-0.5 font-mono text-[0.78rem] leading-snug print:text-[6.5pt]">
                  {b.lines.map((l, k) => (
                    <li key={k}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
