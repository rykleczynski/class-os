"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { StepperBlock } from "@/lib/lesson/schema";
import { BlockFrame, type BlockProps } from "./shared";

export function Stepper({ block }: BlockProps<StepperBlock>) {
  const [i, setI] = useState(0);
  const frame = block.frames[i];
  const last = block.frames.length - 1;
  return (
    <BlockFrame title={block.title}>
      <div className="mb-3 flex gap-1.5" aria-hidden>
        {block.frames.map((_, k) => (
          <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-coral" : "bg-muted"}`} />
        ))}
      </div>
      <div className="min-h-32" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step {i + 1} of {block.frames.length}
        </p>
        <p className="mt-1 font-semibold">{frame.title}</p>
        <p className="mt-1 text-[0.95rem] leading-relaxed">{frame.text}</p>
        {frame.math && (
          <pre className="mt-3 overflow-x-auto rounded-xl border border-paper-border bg-paper px-3 py-2 font-mono text-sm">{frame.math}</pre>
        )}
      </div>
      <div className="mt-3 flex justify-between">
        <button
          type="button"
          disabled={i === 0}
          onClick={() => setI((v) => v - 1)}
          className="inline-flex min-h-10 items-center gap-1 rounded-full border border-border px-3.5 text-sm font-semibold transition-colors hover:border-control disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          disabled={i === last}
          onClick={() => setI((v) => v + 1)}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </BlockFrame>
  );
}
