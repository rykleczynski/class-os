"use client";

import { useState } from "react";
import type { ScenarioBlock } from "@/lib/lesson/schema";
import { BlockFrame, type BlockProps } from "./shared";

const VERDICT = {
  best: { label: "Strong call", cls: "bg-good-soft text-good", border: "border-good" },
  ok: { label: "Defensible", cls: "bg-warn-soft text-warn", border: "border-warn" },
  poor: { label: "Risky", cls: "bg-bad-soft text-bad", border: "border-bad" },
} as const;

export function Scenario({ block, blockId, onAttempt }: BlockProps<ScenarioBlock>) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    onAttempt?.(blockId, i, block.choices[i].verdict === "best");
  };

  return (
    <BlockFrame title={block.title}>
      <div data-testid="scenario">
        <p className="text-[0.95rem] leading-relaxed">{block.prompt}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What do you do?</p>
        <div className="mt-2 space-y-2">
          {block.choices.map((c, i) => {
            const v = VERDICT[c.verdict];
            const isPicked = picked === i;
            return (
              <div key={i}>
                <button
                  type="button"
                  disabled={answered}
                  onClick={() => choose(i)}
                  className={`min-h-12 w-full rounded-xl border-[1.5px] px-3 py-2.5 text-left text-[0.95rem] transition-colors ${
                    isPicked ? v.border : "border-border"
                  } ${answered && !isPicked ? "opacity-60" : "hover:border-control"} bg-paper-card`}
                >
                  {c.label}
                </button>
                {isPicked && (
                  <div data-testid="scenario-outcome" role="status" className={`mt-2 rounded-xl px-3 py-2 text-sm ${v.cls}`}>
                    <p className="font-semibold">{v.label}</p>
                    <p className="mt-0.5 text-foreground">{c.outcome}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {answered && (
          <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-sm">
            <p className="font-semibold">Debrief</p>
            <p className="mt-0.5 leading-relaxed">{block.debrief}</p>
          </div>
        )}
      </div>
    </BlockFrame>
  );
}
