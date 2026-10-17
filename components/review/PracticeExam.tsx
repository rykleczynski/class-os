"use client";

import { useState } from "react";
import type { Countdown } from "@/lib/review/countdown";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Md } from "@/components/Md";
import { partLabel, type PracticeQuestion, type Review } from "@/lib/review/schema";
import type { ReviewState } from "@/lib/review/progress";
import { Card } from "./shared";

type Update = (fn: (s: ReviewState) => ReviewState) => void;
/** By label, not position, so saved work stays with its prompt when a rebuild adds or reorders parts. */
const partKey = (q: PracticeQuestion, i: number) => `${q.id}:${partLabel(q.parts[i].label)}`;

/** Splits questions into the timed mock (in mock order; all questions when no mock is set) and extra practice grouped by topic. */
export function splitPractice(review: Review) {
  const { questions, mock } = review.practiceExam;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const mockQs = mock.length ? mock.flatMap((id) => byId.get(id) ?? []) : questions;
  const inMock = new Set(mockQs.map((q) => q.id));
  const extra = review.sections
    .map((s) => ({ section: s, questions: questions.filter((q) => !inMock.has(q.id) && q.sectionIds[0] === s.id) }))
    .filter((g) => g.questions.length > 0);
  return { mock: mockQs, extra };
}

function tally(qs: PracticeQuestion[], state: ReviewState) {
  const parts = qs.flatMap((q) => q.parts.map((p, i) => ({ key: partKey(q, i), points: p.points })));
  const graded = parts.filter((p) => state.scores[p.key] !== undefined);
  return {
    parts: parts.length,
    possible: parts.reduce((n, p) => n + p.points, 0),
    graded: graded.length,
    earned: graded.reduce((n, p) => n + (state.scores[p.key] ?? 0), 0),
    gradedPossible: graded.reduce((n, p) => n + p.points, 0),
  };
}

export function PracticeExam({ review, state, update, timer }: { review: Review; state: ReviewState; update: Update; timer: Countdown }) {
  const exam = review.practiceExam;
  const sectionTitle = new Map(review.sections.map((s) => [s.id, s.title]));
  const titles = (q: PracticeQuestion) => q.sectionIds.map((id) => sectionTitle.get(id) ?? id);
  const { mock, extra } = splitPractice(review);
  const m = tally(mock, state);
  const x = tally(extra.flatMap((g) => g.questions), state);

  const reset = () => update((s) => ({ ...s, answers: {}, scores: {} }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mock exam</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {mock.length} questions · {m.possible} points · {exam.minutes} minutes
          </p>
          <div className="mt-2 text-sm text-muted-foreground">
            <Md text={exam.instructions} />
          </div>
        </header>
        {mock.map((q, qi) => (
          <Question key={q.id} n={qi + 1} q={q} sections={titles(q)} state={state} update={update} />
        ))}
        {extra.length > 0 && (
          <section aria-labelledby="extra-title" className="space-y-6 border-t border-paper-border pt-6">
            <header>
              <h2 id="extra-title" className="text-2xl font-semibold tracking-tight">More practice by topic</h2>
              <p className="mt-1 text-sm text-muted-foreground">Untimed. Same format, so do the ones for your weakest topics.</p>
            </header>
            {extra.map((g) => (
              <div key={g.section.id} className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.section.title}</h3>
                {g.questions.map((q) => (
                  <Question key={q.id} q={q} sections={titles(q)} state={state} update={update} />
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
      {/* Timer first on phones, where a sidebar would land below every question. */}
      <aside className="order-first space-y-6 lg:sticky lg:top-32 lg:order-none lg:self-start">
        <Timer timer={timer} />
        <Card title="Mock exam score">
          <p className="text-3xl font-semibold tabular-nums">
            {m.earned}
            <span className="text-base text-muted-foreground"> / {m.gradedPossible || m.possible}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {m.graded} of {m.parts} parts graded · {m.possible} points total. Reveal a solution, then grade yourself against the rubric.
          </p>
          {x.parts > 0 && (
            <p className="mt-3 text-sm">
              Extra practice: <span className="font-semibold tabular-nums">{x.earned}</span>
              <span className="text-muted-foreground"> / {x.gradedPossible} graded ({x.graded} of {x.parts} parts)</span>
            </p>
          )}
          <button type="button" onClick={reset} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-semibold hover:border-control">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear answers and scores
          </button>
        </Card>
      </aside>
    </div>
  );
}

function Question({ n, q, sections, state, update }: { n?: number; q: PracticeQuestion; sections: string[]; state: ReviewState; update: Update }) {
  const total = q.parts.reduce((s, p) => s + p.points, 0);
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          {n !== undefined && `${n}. `}
          {q.title}
        </h2>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{total} pts</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{sections.join(" · ")}</p>
      <div className="mt-3 text-[0.95rem] leading-relaxed">
        <Md text={q.setup} />
      </div>
      <ol className="mt-4 space-y-5">
        {q.parts.map((p, i) => (
          <Part key={i} q={q} i={i} state={state} update={update} />
        ))}
      </ol>
    </Card>
  );
}

function Part({ q, i, state, update }: { q: PracticeQuestion; i: number; state: ReviewState; update: Update }) {
  const p = q.parts[i];
  const label = partLabel(p.label);
  const key = partKey(q, i);
  const [open, setOpen] = useState(false);
  const score = state.scores[key];
  const setScore = (v: number | undefined) =>
    update((s) => {
      const scores = { ...s.scores };
      if (v === undefined) delete scores[key];
      else scores[key] = Math.min(p.points, Math.max(0, v));
      return { ...s, scores };
    });

  return (
    <li className="rounded-2xl border border-paper-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">({label})</p>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">{p.points} pts</span>
      </div>
      <div className="mt-1 text-[0.95rem]">
        <Md text={p.prompt} />
      </div>
      <label className="mt-3 block">
        <span className="sr-only">Your answer to part {label}</span>
        <textarea
          value={state.answers[key] ?? ""}
          onChange={(e) => update((s) => ({ ...s, answers: { ...s.answers, [key]: e.target.value } }))}
          rows={4}
          placeholder="Work it out here first. Saved in this browser."
          className="w-full rounded-xl border border-border bg-paper p-3 font-mono text-sm leading-relaxed outline-none focus:border-control"
        />
      </label>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Reveal solution
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl bg-good-soft p-3 text-sm">
            <p className="font-semibold text-good">Model answer</p>
            <div className="mt-1">
              <Md text={q.solutions[i]} />
            </div>
          </div>
          {i === q.parts.length - 1 && q.rubric.length > 0 && (
            <div className="rounded-2xl border border-paper-border p-3 text-sm">
              <p className="font-semibold">Rubric</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {q.rubric.map((r, k) => (
                  <li key={k}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Your points
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={p.points}
              step={0.5}
              value={score ?? ""}
              onChange={(e) => setScore(e.target.value === "" ? undefined : Number(e.target.value))}
              className="w-20 rounded-lg border border-border bg-paper px-2 py-1 tabular-nums outline-none focus:border-control"
            />
            <span className="font-normal text-muted-foreground">of {p.points}</span>
          </label>
        </div>
      )}
    </li>
  );
}

/** The mock-exam clock. The countdown lives in the page shell, so switching tabs does not reset it. */
function Timer({ timer }: { timer: Countdown }) {
  const { left, running, total } = timer;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <Card title="Timer">
      <p className={`font-mono text-3xl tabular-nums ${left === 0 ? "text-bad" : ""}`} aria-live="polite">
        {mm}:{ss}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{left === 0 ? "Time. Pens down." : `${total / 60} minutes, like the real thing.`}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={running ? timer.pause : timer.start} disabled={left === 0} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {running ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {running ? "Pause" : left === total ? "Start" : "Resume"}
        </button>
        <button type="button" onClick={timer.reset} className="inline-flex min-h-10 items-center rounded-full border border-border px-3.5 text-sm font-semibold hover:border-control">
          Reset
        </button>
      </div>
    </Card>
  );
}
