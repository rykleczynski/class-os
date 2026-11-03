"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Md } from "@/components/Md";
import { Button } from "@/components/ui/button";
import { clampCardIndex, type DeckCard } from "@/lib/homework-deck";
import type { HomeworkModule, HomeworkStatus } from "@/lib/homework-spec";
import { cn } from "@/lib/utils";

type DeckEntry = { answer: string; status: HomeworkStatus | null };

/** Every storage access is guarded: without storage the deck just starts at the first card. */
const cardKey = (slug: string) => `classos:homework:${slug}:card`;

function readCard(slug: string): number {
  try {
    return Number(localStorage.getItem(cardKey(slug)) ?? 0);
  } catch {
    return 0;
  }
}

function writeCard(slug: string, index: number) {
  try {
    localStorage.setItem(cardKey(slug), String(index));
  } catch {
    /* storage full or blocked: the position just is not remembered */
  }
}

function clearCard(slug: string) {
  try {
    localStorage.removeItem(cardKey(slug));
  } catch {
    /* storage blocked: nothing was written either */
  }
}

/**
 * The current card, remembered per set. It lives in a hook because the page header shows the
 * position too. forget() is for Lock: a click still in flight must not write the key back.
 */
export function useDeckPosition(slug: string, deckLength: number) {
  const [stored, setStored] = useState(() => readCard(slug));
  const forgotten = useRef(false);

  const goTo = useCallback(
    (next: number) => {
      const index = clampCardIndex(next, deckLength);
      setStored(index);
      if (!forgotten.current) writeCard(slug, index);
    },
    [slug, deckLength],
  );

  const forget = useCallback(() => {
    forgotten.current = true;
    clearCard(slug);
  }, [slug]);

  return { index: clampCardIndex(stored, deckLength), goTo, forget };
}

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const INTERACTIVE = `${TYPING}, a[href], button, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])`;

const matches = (target: EventTarget | null, selector: string) => target instanceof Element && target.closest(selector) !== null;

function cardLabel(card: DeckCard, flipped: boolean): string {
  if (card.kind === "intro") return card.title;
  if (card.kind === "concept") return `Concept: ${card.title}`;
  if (card.kind === "finish") return "Finish";
  return `Question ${card.module.id}, ${flipped ? "how to solve it" : "question side"}`;
}

export function Deck({
  deck,
  index,
  onNavigate,
  entries,
  onAnswer,
  onStatus,
  exportPanel,
}: {
  deck: DeckCard[];
  index: number;
  onNavigate: (index: number) => void;
  entries: Record<string, DeckEntry | undefined>;
  onAnswer: (id: string, answer: string) => void;
  onStatus: (id: string, status: HomeworkStatus) => void;
  exportPanel: ReactNode;
}) {
  const card = deck[index];
  const total = deck.length;
  // Holds the key of the flipped card, so leaving a card always brings it back to its front.
  const [flippedKey, setFlippedKey] = useState<string | null>(null);
  const flipped = flippedKey === card.key;
  const containerRef = useRef<HTMLDivElement>(null);
  // Set by a user action: restoring the remembered card on load must not steal focus.
  const moved = useRef(false);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= total || next === index) return;
      moved.current = true;
      setFlippedKey(null);
      onNavigate(next);
    },
    [index, total, onNavigate],
  );

  const flip = useCallback(() => {
    moved.current = true;
    setFlippedKey((k) => (k === card.key ? null : card.key));
  }, [card.key]);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    window.scrollTo(0, 0);
    containerRef.current?.focus({ preventScroll: true });
  }, [index, flipped]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (matches(e.target, TYPING)) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        go(index + (e.key === "ArrowRight" ? 1 : -1));
      } else if (e.key === " " && card.kind === "problem" && !e.repeat && !matches(e.target, INTERACTIVE)) {
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card.kind, flip, go, index]);

  const status = card.kind === "problem" ? (entries[card.module.id]?.status ?? null) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* The scroll margins keep a focused control clear of the sticky header and nav bar. */}
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 pb-6 pt-5 [&_*]:scroll-mb-24 [&_*]:scroll-mt-32">
        <div
          ref={containerRef}
          tabIndex={-1}
          role="group"
          aria-roledescription="card"
          aria-label={`Card ${index + 1} of ${total}. ${cardLabel(card, flipped)}`}
          data-testid="deck-card"
          data-card={card.key}
          data-side={card.kind === "problem" ? (flipped ? "back" : "front") : undefined}
          className={cn(
            "min-w-0 rounded-2xl border p-4 shadow-soft outline-none sm:p-5",
            card.kind === "intro" ? "border-warn/40 bg-warn-soft" : "bg-card",
            card.kind !== "intro" && (status === "got" ? "border-good" : status === "review" ? "border-warn" : "border-border"),
          )}
        >
          {card.kind === "intro" && <IntroCard key={card.key} title={card.title} items={card.items} />}
          {card.kind === "concept" && <ConceptCard key={card.key} title={card.title} body={card.body} />}
          {card.kind === "problem" && (
            <ProblemCard
              key={card.key}
              m={card.module}
              entry={entries[card.module.id]}
              flipped={flipped}
              onFlip={flip}
              onAnswer={(answer) => onAnswer(card.module.id, answer)}
              onStatus={(s) => onStatus(card.module.id, s)}
            />
          )}
          {card.kind === "finish" && <FinishCard key={card.key} deck={deck} entries={entries} onJump={go} exportPanel={exportPanel} />}
        </div>
      </div>

      {/* In the flow after the card, so at the end of a long card the bar sits below it instead of over it. */}
      <nav aria-label="Cards" className="sticky bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Button variant="outline" className="size-11 rounded-full" aria-label="Previous card" disabled={index === 0} onClick={() => go(index - 1)}>
            <ArrowLeft aria-hidden />
          </Button>
          <p className="text-sm tabular-nums text-muted-foreground" data-testid="deck-position">
            Card {index + 1} of {total}
          </p>
          <Button className="size-11 rounded-full" aria-label="Next card" disabled={index === total - 1} onClick={() => go(index + 1)}>
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </nav>
    </div>
  );
}

const FADE = "animate-in fade-in duration-200 motion-reduce:animate-none";
const LABEL = "font-mono text-xs font-semibold uppercase tracking-wider text-(--course)";
const SECTION_LABEL = "font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground";

function IntroCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn("text-sm", FADE)}>
      <p className="font-semibold text-warn">{title}</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 [overflow-wrap:anywhere]">
        {items.map((item, i) => (
          <li key={i}>
            <Md text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConceptCard({ title, body }: { title: string; body: string[] }) {
  return (
    <div className={FADE}>
      <p className={LABEL}>Concept</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</h2>
      <div className="mt-3 space-y-3 [overflow-wrap:anywhere]">
        {body.map((text, i) => (
          <Md key={i} text={text} />
        ))}
      </div>
    </div>
  );
}

function ProblemCard({
  m,
  entry,
  flipped,
  onFlip,
  onAnswer,
  onStatus,
}: {
  m: HomeworkModule;
  entry: DeckEntry | undefined;
  flipped: boolean;
  onFlip: () => void;
  onAnswer: (answer: string) => void;
  onStatus: (status: HomeworkStatus) => void;
}) {
  return (
    <>
      {/* The key swaps and fades only this side. The answer box below stays mounted across a flip. */}
      <div key={flipped ? "back" : "front"} className={FADE}>
        {flipped ? <ProblemBack m={m} status={entry?.status ?? null} onFlip={onFlip} onStatus={onStatus} /> : <ProblemFront m={m} onFlip={onFlip} />}
      </div>
      <AnswerBox id={m.id} answer={entry?.answer ?? ""} onAnswer={onAnswer} />
    </>
  );
}

function ProblemFront({ m, onFlip }: { m: HomeworkModule; onFlip: () => void }) {
  return (
    <>
      <p className={LABEL}>Question {m.id}</p>
      {m.ctx && <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{m.ctx}</p>}
      <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">{m.q}</p>
      {m.nudge && (
        <details className="mt-3 border-t border-border pt-2">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Nudge</summary>
          <p className="mt-1.5 text-sm [overflow-wrap:anywhere]">{m.nudge}</p>
        </details>
      )}
      <Button className="mt-4 h-11 px-4" onClick={onFlip}>
        Show how to solve it
      </Button>
    </>
  );
}

function ProblemBack({
  m,
  status,
  onFlip,
  onStatus,
}: {
  m: HomeworkModule;
  status: HomeworkStatus | null;
  onFlip: () => void;
  onStatus: (status: HomeworkStatus) => void;
}) {
  return (
    <>
      <p className={LABEL}>Question {m.id}</p>
      <div className="mt-2 border-l-2 border-(--course) pl-3 text-sm text-muted-foreground">
        {m.ctx && <p className="mb-1 [overflow-wrap:anywhere]">{m.ctx}</p>}
        <p className="whitespace-pre-line [overflow-wrap:anywhere]">{m.q}</p>
      </div>

      {m.steps && (
        <div className="mt-4">
          <h3 className="font-semibold">How to do it</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 [overflow-wrap:anywhere]">
            {m.steps.map((step, i) => (
              <li key={i} className="whitespace-pre-line">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-muted p-3 text-sm">
        <p className={SECTION_LABEL}>Sample answer</p>
        {m.s.map((p, i) =>
          p.startsWith("~") ? (
            <pre key={i} className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
              {/* Continuation lines may repeat the "~" marker; it is never part of the math. The hanging indent marks a wrapped line on a phone. */}
              {p
                .slice(1)
                .replace(/^~/gm, "")
                .split("\n")
                .map((line, j) => (
                  <span key={j} className="block pl-3 -indent-3">
                    {line || " "}
                  </span>
                ))}
            </pre>
          ) : (
            <p key={i} className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">
              {p}
            </p>
          ),
        )}
      </div>

      <details className="mt-3 border-t border-border pt-2">
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Lecture pointer</summary>
        <p className="mt-1.5 text-sm [overflow-wrap:anywhere]">{m.ptr}</p>
      </details>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex" role="group" aria-label={`Mark question ${m.id}`}>
          <button
            type="button"
            aria-pressed={status === "got"}
            onClick={() => onStatus("got")}
            className={cn(
              "h-11 rounded-l-lg border px-3 text-sm font-medium transition-colors",
              status === "got" ? "border-good bg-good-soft text-good" : "border-border bg-background hover:bg-muted",
            )}
          >
            Got it
          </button>
          <button
            type="button"
            aria-pressed={status === "review"}
            onClick={() => onStatus("review")}
            className={cn(
              "-ml-px h-11 rounded-r-lg border px-3 text-sm font-medium transition-colors",
              status === "review" ? "border-warn bg-warn-soft text-warn" : "border-border bg-background hover:bg-muted",
            )}
          >
            Needs review
          </button>
        </div>
        <Button variant="outline" className="h-11 px-3" onClick={onFlip}>
          <RotateCcw aria-hidden />
          Back to the question
        </Button>
      </div>
    </>
  );
}

function AnswerBox({ id, answer, onAnswer }: { id: string; answer: string; onAnswer: (answer: string) => void }) {
  // Starts open for a saved answer, then follows the reader so typing never collapses the box.
  const [open, setOpen] = useState(() => answer.trim().length > 0);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="mt-4 border-t border-border pt-2">
      <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">My answer (optional)</summary>
      <textarea
        id={`ans-${id}`}
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        maxLength={20000}
        aria-label={`Your answer to question ${id}`}
        placeholder="Write your answer here. It saves as you type."
        className="mt-2 min-h-32 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </details>
  );
}

function FinishCard({
  deck,
  entries,
  onJump,
  exportPanel,
}: {
  deck: DeckCard[];
  entries: Record<string, DeckEntry | undefined>;
  onJump: (index: number) => void;
  exportPanel: ReactNode;
}) {
  const problems = deck.flatMap((card, index) => (card.kind === "problem" ? [{ m: card.module, index }] : []));
  const got = problems.filter((p) => entries[p.m.id]?.status === "got").length;
  const review = problems.filter((p) => entries[p.m.id]?.status === "review");

  return (
    <div className={FADE}>
      <p className={LABEL}>Finish</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">End of the deck</h2>
      <dl className="mt-3 flex gap-6 tabular-nums">
        <div>
          <dt className="text-sm text-muted-foreground">Got it</dt>
          <dd className="text-2xl font-semibold text-good" data-testid="finish-got">
            {got}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Needs review</dt>
          <dd className="text-2xl font-semibold text-warn" data-testid="finish-review">
            {review.length}
          </dd>
        </div>
      </dl>

      {review.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Cards marked Needs review">
          {review.map(({ m, index }) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onJump(index)}
                className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="shrink-0 font-mono text-xs font-semibold text-(--course)">{m.id}</span>
                <span className="min-w-0 flex-1 truncate">{m.q}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" className="mt-4 h-11 px-3" onClick={() => onJump(0)}>
        <RotateCcw aria-hidden />
        Back to first card
      </Button>

      <div className="mt-4">{exportPanel}</div>
    </div>
  );
}
