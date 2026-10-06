"use client";

import { useState } from "react";
import type { Lesson, OnAttempt } from "@/lib/lesson/schema";
import { Check, X } from "lucide-react";
import { Mcq } from "@/components/blocks/Mcq";

export function Quiz({
  lesson,
  onAttempt,
  onDone,
}: {
  lesson: Pick<Lesson, "quiz" | "recap">;
  onAttempt: OnAttempt;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { picked: number; correct: boolean }>>({});
  const [finished, setFinished] = useState(false);
  const q = lesson.quiz[i];
  const answered = answers[i] !== undefined;
  const score = Object.values(answers).filter((a) => a.correct).length;

  if (finished) {
    const misses = lesson.quiz.map((qq, k) => ({ qq, k, a: answers[k] })).filter((x) => x.a && !x.a.correct);
    return (
      <div className="space-y-5" data-testid="quiz-results">
        <div className="rounded-3xl bg-ink p-6 text-ink-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Quiz score</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight" data-testid="quiz-score">
            {score}/{lesson.quiz.length}
          </p>
          <p className="mt-2 text-sm text-ink-muted">{score === lesson.quiz.length ? "Clean sweep." : score >= 3 ? "Solid. Check the misses below." : "Worth another pass through the steps."}</p>
        </div>
        <section className="rounded-2xl border border-paper-border bg-paper-card p-4">
          <h3 className="font-semibold">Recap</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem]">
            {lesson.recap.map((r, k) => (
              <li key={k}>{r}</li>
            ))}
          </ul>
        </section>
        {misses.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-semibold">What you missed</h3>
            {misses.map(({ qq, k, a }) => (
              <div key={k} className="rounded-2xl border border-paper-border bg-paper-card p-4 text-sm">
                <p className="font-semibold">{qq.q}</p>
                <p className="mt-2 flex gap-1.5 text-bad"><X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>Your answer: {qq.options[a!.picked]}</span></p>
                <p className="mt-1 flex gap-1.5 text-good"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>Correct: {qq.options[qq.answer]}</span></p>
                <p className="mt-1 text-muted-foreground">{qq.why}</p>
              </div>
            ))}
          </section>
        )}
        <button type="button" onClick={onDone} className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          On to flashcards
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Question {i + 1} of {lesson.quiz.length}
      </p>
      <div className="rounded-2xl border border-paper-border bg-paper-card p-4 shadow-soft sm:p-5">
        <Mcq
          key={i}
          compact
          block={q}
          blockId={q.id ?? `quiz:${i}`}
          onAttempt={(id, ans, correct) => {
            setAnswers((a) => ({ ...a, [i]: { picked: ans as number, correct } }));
            onAttempt(id, ans, correct);
          }}
        />
      </div>
      {answered && (
        <button
          type="button"
          onClick={() => (i + 1 < lesson.quiz.length ? setI(i + 1) : setFinished(true))}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {i + 1 < lesson.quiz.length ? "Next question" : "See my score"}
        </button>
      )}
    </div>
  );
}
