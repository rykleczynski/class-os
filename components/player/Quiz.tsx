"use client";

import { useState } from "react";
import type { Lesson, OnAttempt } from "@/lib/lesson/schema";
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
        <div className="rounded-3xl bg-lime p-6 text-lime-foreground">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Quiz score</p>
          <p className="text-5xl font-extrabold tabular-nums" data-testid="quiz-score">
            {score}/{lesson.quiz.length}
          </p>
          <p className="mt-1 text-sm font-semibold">{score === lesson.quiz.length ? "Clean sweep." : score >= 3 ? "Solid. Check the misses below." : "Worth another pass through the steps."}</p>
        </div>
        <section className="rounded-2xl border border-paper-border bg-paper-card p-4">
          <h3 className="font-bold">Recap</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem]">
            {lesson.recap.map((r, k) => (
              <li key={k}>{r}</li>
            ))}
          </ul>
        </section>
        {misses.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-bold">What you missed</h3>
            {misses.map(({ qq, k, a }) => (
              <div key={k} className="rounded-2xl border border-paper-border bg-paper-card p-4 text-sm">
                <p className="font-semibold">{qq.q}</p>
                <p className="mt-1 text-bad">Your answer: {qq.options[a!.picked]}</p>
                <p className="text-good">Correct: {qq.options[qq.answer]}</p>
                <p className="mt-1 text-muted-foreground">{qq.why}</p>
              </div>
            ))}
          </section>
        )}
        <button type="button" onClick={onDone} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background">
          On to flashcards
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Question {i + 1} of {lesson.quiz.length}
      </p>
      <div className="rounded-2xl border border-paper-border bg-paper-card p-4 sm:p-5">
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
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background"
        >
          {i + 1 < lesson.quiz.length ? "Next question" : "See my score"}
        </button>
      )}
    </div>
  );
}
