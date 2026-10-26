"use client";

import { useMemo, useState } from "react";
import { Check, Printer } from "lucide-react";
import { Md } from "@/components/Md";
import { glossaryMatcher, type GlossaryEntry } from "@/lib/review/glossary";
import type { NotesBuilder, Review } from "@/lib/review/schema";
import type { ReviewState } from "@/lib/review/progress";
import { Card, Meter, fmtDate } from "./shared";

type Update = (fn: (s: ReviewState) => ReviewState) => void;

/** The Notes sheet tab: a guide for the handwritten sheet when the review has one, else the printable draft. */
export function NotesSheet({ review, state, update }: { review: Review; state: ReviewState; update: Update }) {
  return review.notesBuilder ? <NotesGuide guide={review.notesBuilder} state={state} update={update} /> : <PrintableDraft review={review} />;
}

const PRIORITY = {
  must: { label: "Must", cls: "bg-coral-soft text-coral" },
  should: { label: "Should", cls: "bg-warn-soft text-warn" },
  nice: { label: "Nice", cls: "bg-muted text-muted-foreground" },
} as const;

const KIND: Record<NotesBuilder["lectures"][number]["items"][number]["kind"], string> = {
  formula: "Formula",
  definition: "Definition",
  result: "Result",
  method: "Method",
  example: "Example",
  warning: "Watch out",
};

function NotesGuide({ guide, state, update }: { guide: NotesBuilder; state: ReviewState; update: Update }) {
  const [mustOnly, setMustOnly] = useState(false);
  const [showKey, setShowKey] = useState(true);
  const matcher = useMemo(() => glossaryMatcher(guide.glossary), [guide.glossary]);
  const written = new Set(state.sheet);
  const all = guide.lectures.flatMap((l) => l.items);
  const must = all.filter((i) => i.priority === "must");
  const count = (items: typeof all) => ({ done: items.filter((i) => written.has(i.id)).length, total: items.length });
  const toggle = (id: string) => update((s) => ({ ...s, sheet: written.has(id) ? s.sheet.filter((x) => x !== id) : [...s.sheet, id] }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your notes sheet</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {guide.allowance} Everything worth writing on it, lecture by lecture. Tick each line once it is on your sheet.
          </p>
        </header>

        <nav aria-label="Lectures" className="flex flex-wrap gap-2">
          {guide.lectures.map((l) => (
            <a key={l.date} href={`#lecture-${l.date}`} className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:border-control">
              {fmtDate(l.date)}
            </a>
          ))}
          <span className="ml-auto flex flex-wrap items-center gap-4">
            {guide.glossary.length > 0 && (
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} className="h-4 w-4 accent-(--course)" />
                Spell out abbreviations
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={mustOnly} onChange={(e) => setMustOnly(e.target.checked)} className="h-4 w-4 accent-(--course)" />
              Must-haves only
            </label>
          </span>
        </nav>

        {guide.lectures.map((l) => {
          const items = mustOnly ? l.items.filter((i) => i.priority === "must") : l.items;
          const c = count(l.items);
          return (
            <section key={l.date} id={`lecture-${l.date}`} aria-labelledby={`lecture-${l.date}-title`} className="scroll-mt-32 rounded-3xl border border-paper-border bg-paper-card p-5 shadow-soft sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fmtDate(l.date)}</p>
              <h2 id={`lecture-${l.date}-title`} className="mt-0.5 text-lg font-semibold tracking-tight">
                {l.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{l.space}</p>
              <div className="mt-3">
                <Meter label="Written" done={c.done} total={c.total} />
              </div>
              <ul className="mt-4 space-y-2">
                {items.map((it) => {
                  const on = written.has(it.id);
                  const terms = showKey ? matcher.termsIn(it.text) : [];
                  return (
                    <li key={it.id}>
                      <label className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition-colors ${on ? "border-good bg-good-soft/50" : "border-paper-border hover:border-control"}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(it.id)} className="mt-1 h-4 w-4 shrink-0 accent-(--course)" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${PRIORITY[it.priority].cls}`}>{PRIORITY[it.priority].label}</span>
                            <span className="text-xs font-semibold text-muted-foreground">{KIND[it.kind]}</span>
                          </span>
                          <span className={`mt-1.5 block font-mono text-sm leading-relaxed ${on ? "text-muted-foreground line-through decoration-good/60" : ""}`}>
                            {matcher.segments(it.text).map((s, k) =>
                              s.entry ? (
                                <abbr key={k} title={s.entry.meaning} className={`cursor-help ${on ? "" : "underline decoration-dotted decoration-muted-foreground/60 underline-offset-2"}`}>
                                  {s.text}
                                </abbr>
                              ) : (
                                s.text
                              ),
                            )}
                          </span>
                          {terms.length > 0 && <TermKey terms={terms} />}
                          <span className="mt-1 block text-xs text-muted-foreground">{it.why}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="order-first space-y-6 lg:sticky lg:top-32 lg:order-none lg:self-start">
        <Card title="Progress">
          <div className="space-y-3">
            <Meter label="Must-haves written" done={count(must).done} total={count(must).total} />
            <Meter label="Everything" done={count(all).done} total={count(all).total} />
          </div>
          {count(must).total > 0 && count(must).done === count(must).total && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-good">
              <Check className="h-4 w-4" aria-hidden /> Every must-have is on your sheet.
            </p>
          )}
        </Card>
        {guide.glossary.length > 0 && (
          <Card title="Key">
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Every abbreviation on the sheet ({guide.glossary.length})</summary>
              <dl className="mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 text-sm">
                {guide.glossary.map((e) => (
                  <div key={e.term}>
                    <dt className="inline font-mono font-semibold">{[e.term, ...e.aka].join(", ")}</dt>
                    <dd className="inline text-muted-foreground"> {e.meaning}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </Card>
        )}
        <Card title="Laying it out">
          <ul className="space-y-2 text-sm">
            {guide.layout.map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--course)" aria-hidden />
                <Md text={tip} />
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}

/** The abbreviations one line uses, spelled out under it. */
function TermKey({ terms }: { terms: GlossaryEntry[] }) {
  return (
    <span className="mt-1.5 block rounded-xl bg-muted/60 px-2.5 py-1.5 text-xs leading-relaxed">
      {terms.map((e, i) => (
        <span key={e.term}>
          {i > 0 && <span className="text-muted-foreground"> · </span>}
          <span className="font-mono font-semibold">{e.term}</span> <span className="text-muted-foreground">{e.meaning}</span>
        </span>
      ))}
    </span>
  );
}

/** The allowed notes sheet, drafted. Prints one side per page. Used when a review has no notes guide. */
function PrintableDraft({ review }: { review: Review }) {
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
