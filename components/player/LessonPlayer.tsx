"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { lessonShellSchema, type OnAttempt } from "@/lib/lesson/schema";
import { recordAttempt } from "@/lib/attempts";
import { markCompleted } from "@/lib/progress";
import { Checklist } from "./Checklist";
import { Flashcards } from "./Flashcards";
import { Quiz } from "./Quiz";

type Props = {
  lessonId: string;
  spec: unknown;
  course: { code: string; slug: string; color: string };
  initialStage?: "flashcards";
};

type Attempt = { blockId: string; answer: unknown; correct: boolean; at: number };

export function LessonPlayer({ lessonId, spec, course, initialStage }: Props) {
  const parsed = lessonShellSchema.safeParse(spec);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div role="alert" className="rounded-2xl border border-bad bg-bad-soft p-4">
          <p className="font-bold text-bad">This lesson could not be loaded.</p>
          <p className="mt-1 font-mono text-xs">{parsed.error.issues[0]?.path.join(".")}: {parsed.error.issues[0]?.message}</p>
        </div>
      </div>
    );
  }
  return <Player lessonId={lessonId} lesson={parsed.data} course={course} initialStage={initialStage} />;
}

function Player({ lessonId, lesson, course, initialStage }: Omit<Props, "spec"> & { lesson: ReturnType<typeof lessonShellSchema.parse> }) {
  const nSteps = lesson.steps.length;
  const quizIdx = nSteps;
  const cardsIdx = nSteps + 1;
  const items = [...lesson.steps.map((s) => ({ id: s.id, title: s.title })), { id: "quiz", title: "Quiz" }, { id: "cards", title: "Flashcards" }];

  const start = initialStage === "flashcards" ? cardsIdx : 0;
  const [idx, setIdx] = useState(start);
  const [maxReached, setMaxReached] = useState(start);
  const [dir, setDir] = useState(1);
  const [quizDone, setQuizDone] = useState(initialStage === "flashcards");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const reduce = useReducedMotion();

  const onAttempt: OnAttempt = useCallback((blockId, answer, correct) => {
    // Local state for the UI, plus a best-effort write to the attempts table.
    recordAttempt(lessonId, blockId, answer, correct).catch(() => {});
    setAttempts((a) => [...a, { blockId, answer, correct, at: Date.now() }]);
  }, [lessonId]);

  const go = (next: number) => {
    setDir(next >= idx ? 1 : -1);
    setIdx(next);
    setMaxReached((m) => Math.max(m, next));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const finishQuiz = () => {
    setQuizDone(true);
    markCompleted(lessonId);
    go(cardsIdx);
  };

  const onStep = idx < nSteps;
  const step = onStep ? lesson.steps[idx] : null;
  const canContinue = onStep || (idx === quizIdx && quizDone);
  const pct = (idx / (items.length - 1)) * 100;
  const label = onStep ? `Step ${idx + 1} of ${nSteps}` : idx === quizIdx ? "Quiz" : "Flashcards";
  const continueLabel = idx === nSteps - 1 ? "Take the quiz" : "Continue";

  return (
    <div className="min-h-dvh bg-paper text-foreground">
      <header className="sticky top-0 z-30 border-b border-paper-border bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href={`/course/${course.slug}`} aria-label={`Back to ${course.code}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-paper-border">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold uppercase tracking-wide" style={{ color: course.color }}>
              {course.code}
            </p>
            <p className="truncate text-sm font-bold">{lesson.title}</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground lg:hidden">{label}</span>
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground" />
        </div>
        <div className="h-1 bg-paper-border lg:hidden" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="h-full bg-check transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-32 pt-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <main className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={idx}
              initial={reduce ? false : { opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -dir * 28 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {idx === 0 && (
                <div className="mb-8 rounded-3xl border border-paper-border bg-paper-card p-5">
                  <p className="text-lg font-extrabold leading-snug">{lesson.hook}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {lesson.est_minutes} min · You will be able to
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {lesson.objectives.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {step && (
                <section aria-labelledby="step-title">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <h1 id="step-title" className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
                    {step.title}
                  </h1>
                  <div className="mt-5 space-y-5">
                    {step.blocks.map((b, i) => (
                      <BlockRenderer key={i} block={b} stepId={step.id} index={i} onAttempt={onAttempt} />
                    ))}
                  </div>
                </section>
              )}
              {idx === quizIdx && (
                <section>
                  <h1 className="text-2xl font-extrabold sm:text-3xl">Check yourself</h1>
                  <div className="mt-5">
                    <Quiz lesson={lesson as never} onAttempt={onAttempt} onDone={finishQuiz} />
                  </div>
                </section>
              )}
              {idx === cardsIdx && (
                <section>
                  <h1 className="text-2xl font-extrabold sm:text-3xl">Flashcards</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Tap a card to flip it.</p>
                  <div className="mt-5">
                    <Flashcards cards={lesson.flashcards} />
                  </div>
                  <Link href="/" className="mt-6 inline-flex rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-lime-foreground">
                    Back to dashboard
                  </Link>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-paper-border bg-paper-card p-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Steps</p>
            <Checklist items={items} current={idx} maxReached={maxReached} onJump={go} />
            <p className="mt-5 text-xs text-muted-foreground">{attempts.filter((a) => a.correct).length}/{attempts.length} checks right so far</p>
          </div>
        </aside>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-paper-border bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => go(idx - 1)}
            className="inline-flex items-center gap-1 rounded-full border border-paper-border bg-paper-card px-4 py-2.5 text-sm font-bold disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {idx < cardsIdx && (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => go(idx + 1)}
              className="inline-flex items-center gap-1 rounded-full bg-lime px-6 py-2.5 text-sm font-extrabold text-lime-foreground disabled:opacity-40"
            >
              {idx === quizIdx ? "Flashcards" : continueLabel} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
