"use client";

import { useState, useTransition } from "react";
import { useTimeLeft, type Countdown } from "@/lib/review/countdown";
import { Loader2, Pause, Play, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Md } from "@/components/Md";
import { deleteExam, generateExam } from "@/lib/review/actions";
import { partLabel, type PracticeQuestion, type PracticeSet, type Review, type ReviewSection } from "@/lib/review/schema";
import type { ReviewState } from "@/lib/review/progress";
import { Card } from "./shared";

type Update = (fn: (s: ReviewState) => ReviewState) => void;
/** By label, not position, so saved work stays with its prompt when a rebuild adds or reorders parts. */
const partKey = (q: PracticeQuestion, i: number) => `${q.id}:${partLabel(q.parts[i].label)}`;

export const MOCK_ID = "mock";

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

/** One sit-able exam in the picker: the lecture-built mock, a past midterm, or a generated exam. */
export type ExamChoice = {
  id: string;
  group: "mock" | "past" | "generated";
  title: string;
  source: string;
  minutes: number;
  instructions: string;
  questions: PracticeQuestion[];
  /** Untimed extras below the exam (the mock's topic questions). */
  extra: Array<{ section: ReviewSection; questions: PracticeQuestion[] }>;
  generated?: PracticeSet["generated"];
};

export function examChoices(review: Review, generated: PracticeSet[]): ExamChoice[] {
  const { mock, extra } = splitPractice(review);
  const fromSet = (s: PracticeSet): ExamChoice => ({ id: s.id, group: s.kind, title: s.title, source: s.source, minutes: s.minutes, instructions: s.instructions, questions: s.questions, extra: [], generated: s.generated });
  return [
    { id: MOCK_ID, group: "mock", title: "Mock exam", source: "Built from the lectures in scope", minutes: review.practiceExam.minutes, instructions: review.practiceExam.instructions, questions: mock, extra },
    ...review.pastExams.map(fromSet),
    ...generated.map(fromSet),
  ];
}

function tally(qs: PracticeQuestion[], state: ReviewState) {
  const parts = qs.flatMap((q) => q.parts.map((p, i) => ({ key: partKey(q, i), points: p.points })));
  const graded = parts.filter((p) => state.scores[p.key] !== undefined);
  return {
    keys: parts.map((p) => p.key),
    parts: parts.length,
    possible: parts.reduce((n, p) => n + p.points, 0),
    graded: graded.length,
    earned: graded.reduce((n, p) => n + (state.scores[p.key] ?? 0), 0),
    gradedPossible: graded.reduce((n, p) => n + p.points, 0),
  };
}

type Props = {
  review: Review;
  generated: PracticeSet[];
  state: ReviewState;
  update: Update;
  timer: Countdown;
  activeId: string;
  onSelect: (choice: ExamChoice) => void;
};

export function PracticeExam({ review, generated, state, update, timer, activeId, onSelect }: Props) {
  const choices = examChoices(review, generated);
  // A just-generated exam is selected before the refreshed list arrives; show the mock until it does.
  const exam = choices.find((c) => c.id === activeId) ?? choices[0];
  const sectionTitle = new Map(review.sections.map((s) => [s.id, s.title]));
  const titles = (q: PracticeQuestion) => q.sectionIds.map((id) => sectionTitle.get(id) ?? id);
  const m = tally(exam.questions, state);
  const x = tally(exam.extra.flatMap((g) => g.questions), state);

  // Only this exam's work: other exams keep their answers and scores.
  const reset = () =>
    update((s) => {
      const drop = new Set([...m.keys, ...x.keys]);
      const keep = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.has(k)));
      return { ...s, answers: keep(s.answers), scores: keep(s.scores) };
    });

  return (
    <div className="space-y-6">
      <ExamPicker review={review} choices={choices} activeId={exam.id} state={state} onSelect={onSelect} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <header>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{exam.source}</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">{exam.title}</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {exam.questions.length} questions · {m.possible} points · {exam.minutes} minutes
            </p>
            {exam.group === "generated" && (
              <p className="mt-2 text-xs text-muted-foreground">Written by {exam.generated?.model ?? "a model"} with its numbers checked by a calculator tool. Still check a solution that looks off against the topic guide.</p>
            )}
            <div className="mt-2 text-sm text-muted-foreground">
              <Md text={exam.instructions} />
            </div>
          </header>
          {exam.questions.map((q, qi) => (
            <Question key={q.id} n={qi + 1} q={q} sections={titles(q)} state={state} update={update} />
          ))}
          {exam.extra.length > 0 && (
            <section aria-labelledby="extra-title" className="space-y-6 border-t border-paper-border pt-6">
              <header>
                <h2 id="extra-title" className="text-2xl font-semibold tracking-tight">More practice by topic</h2>
                <p className="mt-1 text-sm text-muted-foreground">Untimed. Same format, so do the ones for your weakest topics.</p>
              </header>
              {exam.extra.map((g) => (
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
          <Card title="Score">
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
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear this exam
            </button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

const GROUPS = [
  { id: "mock", label: "Built from lectures" },
  { id: "past", label: "Past midterms" },
  { id: "generated", label: "Generated for you" },
] as const;

function ExamPicker({ review, choices, activeId, state, onSelect }: { review: Review; choices: ExamChoice[]; activeId: string; state: ReviewState; onSelect: (c: ExamChoice) => void }) {
  return (
    <Card>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const list = choices.filter((c) => c.group === g.id);
            if (list.length === 0 && g.id !== "generated") return null;
            return (
              <div key={g.id}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
                {list.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">None yet. Generate one modeled on the past midterms.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {list.map((c) => {
                      const t = tally(c.questions, state);
                      return (
                        <li key={c.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-pressed={c.id === activeId}
                            onClick={() => onSelect(c)}
                            className={`min-h-10 rounded-full border px-3.5 text-left text-sm font-semibold transition-colors ${c.id === activeId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-control"}`}
                          >
                            {c.group === "generated" ? generatedLabel(c) : c.title}
                            {t.graded > 0 && <span className="ml-2 font-normal tabular-nums opacity-80">{t.earned}/{t.gradedPossible}</span>}
                          </button>
                          {c.group === "generated" && <DeleteGenerated slug={review.slug} choice={c} wasActive={c.id === activeId} onDeleted={() => onSelect(choices[0])} />}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {review.pastExams.length > 0 && (
          // The new exam is not in the list until the page refreshes; select it now with its own saved length.
          <GeneratePanel review={review} onGenerated={(id, minutes) => onSelect({ ...choices[0], id, minutes })} />
        )}
      </div>
    </Card>
  );
}

const generatedLabel = (c: ExamChoice) =>
  `${new Date(c.generated?.createdAt ?? 0).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })}${c.generated && c.generated.difficulty !== "same" ? ` · ${c.generated.difficulty}` : ""}`;

function DeleteGenerated({ slug, choice, wasActive, onDeleted }: { slug: string; choice: ExamChoice; wasActive: boolean; onDeleted: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Delete generated exam ${generatedLabel(choice)}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await deleteExam(slug, choice.id);
          if (r.ok && wasActive) onDeleted();
        })
      }
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
    </button>
  );
}

function GeneratePanel({ review, onGenerated }: { review: Review; onGenerated: (id: string, minutes: number) => void }) {
  const [basedOn, setBasedOn] = useState("all");
  const [difficulty, setDifficulty] = useState<"same" | "harder" | "easier">("same");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const generate = () =>
    start(async () => {
      setError(null);
      const r = await generateExam(review.slug, { basedOn, difficulty });
      if (r.ok) onGenerated(r.id, r.minutes);
      else setError(r.error);
    });
  return (
    <div className="rounded-2xl bg-muted/60 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-(--course)" aria-hidden /> Generate a new practice exam
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">New questions in the same format and at the same difficulty as the past midterms, with full solutions.</p>
      <label className="mt-3 block text-xs font-semibold">
        Model it on
        <select value={basedOn} onChange={(e) => setBasedOn(e.target.value)} disabled={pending} className="mt-1 block w-full rounded-lg border border-border bg-paper px-2 py-1.5 text-sm font-normal">
          <option value="all">All past midterms</option>
          {review.pastExams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="mt-3" disabled={pending}>
        <legend className="text-xs font-semibold">Difficulty</legend>
        <div className="mt-1 flex gap-1.5">
          {(["easier", "same", "harder"] as const).map((d) => (
            <label key={d} className={`flex-1 cursor-pointer rounded-lg border px-2 py-1.5 text-center text-sm ${difficulty === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-paper"}`}>
              <input type="radio" name="difficulty" value={d} checked={difficulty === d} onChange={() => setDifficulty(d)} className="sr-only" />
              {d === "same" ? "Same" : d === "harder" ? "Harder" : "Easier"}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" onClick={generate} disabled={pending} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
        {pending ? "Writing your exam (1 to 3 minutes)…" : "Generate"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
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
  const { left, running } = useTimeLeft(timer); // the per-second render stays in this card
  const { total } = timer;
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
        <button type="button" onClick={() => timer.reset()}className="inline-flex min-h-10 items-center rounded-full border border-border px-3.5 text-sm font-semibold hover:border-control">
          Reset
        </button>
      </div>
    </Card>
  );
}
