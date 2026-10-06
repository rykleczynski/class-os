"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { McqBlock } from "@/lib/lesson/schema";
import { BlockFrame, type BlockProps } from "./shared";

export function Mcq({ block, blockId, onAttempt, compact }: BlockProps<McqBlock> & { compact?: boolean }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const correct = picked === block.answer;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    onAttempt?.(blockId, i, i === block.answer);
  };

  const body = (
    <div data-testid="mcq">
      <p className="font-semibold leading-snug">{block.q}</p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label={block.q}>
        {block.options.map((o, i) => {
          const isPicked = picked === i;
          const isAnswer = i === block.answer;
          let cls = "border-border bg-paper-card hover:border-control";
          if (answered && isAnswer) cls = "border-good bg-good-soft";
          else if (answered && isPicked) cls = "border-bad bg-bad-soft";
          else if (answered) cls = "border-border bg-paper-card opacity-60";
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={answered}
              onClick={() => choose(i)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-[1.5px] px-3 py-2.5 text-left text-[0.95rem] transition-colors ${cls}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  answered && isAnswer ? "bg-good text-paper-card" : answered && isPicked ? "bg-bad text-paper-card" : "border border-control"
                }`}
              >
                {answered && isAnswer ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : answered && isPicked ? <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{o}</span>
              {answered && isAnswer && <span className="shrink-0 text-xs font-semibold text-good">{isPicked ? "Your answer, correct" : "Correct answer"}</span>}
              {answered && isPicked && !isAnswer && <span className="shrink-0 text-xs font-semibold text-bad">Your answer</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <div
          data-testid="mcq-feedback"
          role="status"
          className={`mt-3 rounded-xl px-3 py-2.5 text-sm ${correct ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            {correct ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
            {correct ? "Correct" : "Not quite"}
          </p>
          <p className="mt-0.5 text-foreground">{block.why}</p>
        </div>
      )}
    </div>
  );
  return compact ? body : <BlockFrame>{body}</BlockFrame>;
}
