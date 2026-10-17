"use client";

import { useState } from "react";
import { AlertTriangle, Check, Quote } from "lucide-react";
import { Md } from "@/components/Md";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Mcq } from "@/components/blocks/Mcq";
import type { Review, ReviewSection } from "@/lib/review/schema";
import type { ReviewState } from "@/lib/review/progress";
import { Card, Meter, Mono, WeightBadge, canKey, fmtDate, readiness } from "./shared";

type Props = {
  review: Review;
  sectionId: string;
  onSection: (id: string) => void;
  state: ReviewState;
  update: (fn: (s: ReviewState) => ReviewState) => void;
};

export function TopicGuide({ review, sectionId, onSection, state, update }: Props) {
  const idx = Math.max(0, review.sections.findIndex((s) => s.id === sectionId));
  const s = review.sections[idx];
  const pick = (id: string) => {
    onSection(id);
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Topics" className="lg:sticky lg:top-32 lg:self-start">
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {review.sections.map((x, i) => {
            const r = readiness(review, state, x.id);
            const on = x.id === s.id;
            return (
              <li key={x.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  aria-current={on ? "true" : undefined}
                  onClick={() => pick(x.id)}
                  className={`flex w-56 items-start gap-2 rounded-2xl border p-3 text-left transition-colors lg:w-full ${on ? "border-control bg-paper-card shadow-soft" : "border-transparent hover:bg-muted"}`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold ${r.total && r.done === r.total ? "bg-good text-paper-card" : "border border-control"}`}>
                    {r.total && r.done === r.total ? <Check className="h-3 w-3" strokeWidth={3} aria-label="ready" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug">{x.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <WeightBadge weight={x.weight} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {r.done}/{r.total}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Section key={s.id} review={review} section={s} state={state} update={update} />
    </div>
  );
}

function Section({ review, section: s, state, update }: { review: Review; section: ReviewSection; state: ReviewState; update: Props["update"] }) {
  const items = review.selfCheck.filter((c) => c.sectionId === s.id).map((c) => ({ ...c, key: canKey(c) }));
  const ticked = new Set(state.can);
  const toggle = (key: string) => update((st) => ({ ...st, can: ticked.has(key) ? st.can.filter((k) => k !== key) : [...st.can, key] }));
  const r = readiness(review, state, s.id);

  return (
    <article className="min-w-0 space-y-6" aria-labelledby="section-title">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <WeightBadge weight={s.weight} />
          <span className="text-xs font-semibold text-muted-foreground">Lectures: {s.lectures.map(fmtDate).join(", ")}</span>
        </div>
        <h1 id="section-title" className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {s.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{s.weightWhy}</p>
      </header>

      <Card>
        <Md text={s.summary} className="text-[0.95rem] leading-relaxed" />
      </Card>

      <Card title="Key terms">
        <dl className="grid gap-3 sm:grid-cols-2">
          {s.concepts.map((c) => (
            <div key={c.term} className="rounded-2xl border border-paper-border p-3">
              <dt className="text-sm font-semibold">{c.term}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                <Md text={c.definition} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {s.formulas.length > 0 && (
        <Card title="Models and equations">
          <ul className="space-y-4">
            {s.formulas.map((f) => (
              <li key={f.name}>
                <p className="text-sm font-semibold">{f.name}</p>
                <div className="mt-1.5">
                  <Mono>{f.expr}</Mono>
                </div>
                <div className="mt-1.5 text-sm text-muted-foreground">
                  <Md text={f.meaning} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {s.blocks.length > 0 && (
        <div className="space-y-5">
          {s.blocks.map((b, i) => (
            <BlockRenderer key={i} block={b} stepId={`review:${s.id}`} index={i} />
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Worked examples</h2>
        {s.workedExamples.map((w, i) => (
          <WorkedExample key={i} example={w} />
        ))}
      </div>

      <Card title="Common mistakes">
        <ul className="space-y-2">
          {s.pitfalls.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
              <Md text={p} />
            </li>
          ))}
        </ul>
      </Card>

      {s.quotes.length > 0 && (
        <Card title="What the professor stressed">
          <ul className="space-y-4">
            {s.quotes.map((q, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-(--course)" aria-hidden />
                <div>
                  <p className="italic">&ldquo;{q.quote}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDate(q.date)} · {q.why}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Check yourself</h2>
        {s.checks.map((c, i) => (
          <Mcq key={i} block={c} blockId={c.id ?? `${s.id}:check:${i}`} />
        ))}
      </div>

      <Card title="Can you do this?">
        <Meter label="Ready" done={r.done} total={r.total} />
        <ul className="mt-3 space-y-1">
          {items.map((c) => (
            <li key={c.key}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-2 text-sm hover:bg-muted">
                <input type="checkbox" checked={ticked.has(c.key)} onChange={() => toggle(c.key)} className="mt-0.5 h-4 w-4 accent-(--course)" />
                <span>{c.item}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </article>
  );
}

/** A worked problem revealed one step at a time, so it can be attempted before reading the solution. */
function WorkedExample({ example }: { example: ReviewSection["workedExamples"][number] }) {
  const [shown, setShown] = useState(0);
  const done = shown >= example.steps.length;
  return (
    <Card>
      <h3 className="font-semibold">{example.title}</h3>
      <div className="mt-2 text-[0.95rem] leading-relaxed">
        <Md text={example.prompt} />
      </div>
      <ol className="mt-4 space-y-3">
        {example.steps.slice(0, shown).map((st, i) => (
          <li key={i} className="rounded-2xl border border-paper-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {i + 1}</p>
            <p className="mt-0.5 text-sm font-semibold">{st.title}</p>
            <div className="mt-1 text-sm">
              <Md text={st.text} />
            </div>
            {st.math && (
              <div className="mt-2">
                <Mono>{st.math}</Mono>
              </div>
            )}
          </li>
        ))}
      </ol>
      {done ? (
        <div className="mt-3 rounded-2xl bg-good-soft p-3 text-sm">
          <p className="font-semibold text-good">Answer</p>
          <div className="mt-1">
            <Md text={example.answer} />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShown((n) => n + 1)} className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
            {shown === 0 ? "Show the first step" : "Next step"}
          </button>
          <button type="button" onClick={() => setShown(example.steps.length)} className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-semibold hover:border-control">
            Show full solution
          </button>
        </div>
      )}
    </Card>
  );
}
