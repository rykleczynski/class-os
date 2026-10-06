"use client";

import { useMemo, useState } from "react";
import type { SortOrMatchBlock } from "@/lib/lesson/schema";
import { BlockFrame, type BlockProps } from "./shared";

/** Deterministic shuffle that never returns the identity order. */
function shuffled(labels: string[]): number[] {
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const idx = labels.map((_, i) => i).sort((a, b) => hash(labels[a]) - hash(labels[b]));
  return idx.every((v, i) => v === i) ? idx.reverse() : idx;
}

export function SortOrMatch({ block, blockId, onAttempt }: BlockProps<SortOrMatchBlock>) {
  const pool = useMemo(() => shuffled(block.items.map((i) => i.label)), [block.items]);
  const [order, setOrder] = useState<number[]>([]); // order mode: item indices in chosen order
  const [assign, setAssign] = useState<Record<number, number>>({}); // match mode
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<null | boolean>(null);
  const done = result !== null;

  const total = block.items.length;
  const complete = block.mode === "order" ? order.length === total : Object.keys(assign).length === total;

  const check = () => {
    if (!complete || done) return;
    const ok =
      block.mode === "order"
        ? order.every((v, i) => v === i)
        : block.items.every((it, i) => assign[i] === it.target);
    setResult(ok);
    onAttempt?.(blockId, block.mode === "order" ? order : assign, ok);
  };
  const reset = () => {
    setOrder([]);
    setAssign({});
    setSelected(null);
    setResult(null);
  };

  const chip = "rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition-colors";

  return (
    <BlockFrame>
      <div data-testid="sortormatch">
        <p className="font-semibold leading-snug">{block.prompt}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {block.mode === "order" ? "Tap the items in the right order. Tap a placed item to take it back." : "Tap an item, then tap where it belongs."}
        </p>

        {block.mode === "order" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pool</p>
              {pool.filter((i) => !order.includes(i)).map((i) => (
                <button key={i} type="button" disabled={done} onClick={() => setOrder((o) => [...o, i])} className={`${chip} w-full border-border bg-paper-card`}>
                  {block.items[i].label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Your order</p>
              {order.map((i, pos) => (
                <button
                  key={i}
                  type="button"
                  disabled={done}
                  onClick={() => setOrder((o) => o.filter((v) => v !== i))}
                  className={`${chip} w-full ${done ? (i === pos ? "border-good bg-good-soft" : "border-bad bg-bad-soft") : "border-foreground/30 bg-muted"}`}
                >
                  <span className="mr-2 font-bold">{pos + 1}.</span>
                  {block.items[i].label}
                </button>
              ))}
              {order.length === 0 && <p className="text-sm text-muted-foreground">Nothing placed yet.</p>}
            </div>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              {block.items.map((it, i) => {
                const a = assign[i];
                const state = done ? (a === it.target ? "border-good bg-good-soft" : "border-bad bg-bad-soft") : selected === i ? "border-foreground bg-muted" : "border-border bg-paper-card";
                return (
                  <button key={i} type="button" disabled={done} onClick={() => setSelected(i)} className={`${chip} w-full ${state}`}>
                    {it.label}
                    {a !== undefined && <span className="ml-2 rounded-full bg-foreground px-2 py-0.5 text-xs text-background">{block.targets![a]}</span>}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {block.targets!.map((t, ti) => (
                <button
                  key={ti}
                  type="button"
                  disabled={done || selected === null}
                  onClick={() => {
                    if (selected === null) return;
                    setAssign((m) => ({ ...m, [selected]: ti }));
                    setSelected(null);
                  }}
                  className={`${chip} w-full border-dashed border-border bg-paper-card disabled:opacity-60`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {!done && (
            <button type="button" disabled={!complete} onClick={check} className="rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background disabled:opacity-40">
              Check
            </button>
          )}
          {(done || order.length > 0 || Object.keys(assign).length > 0) && (
            <button type="button" onClick={reset} className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold">
              {done ? "Try again" : "Reset"}
            </button>
          )}
        </div>

        {done && (
          <div data-testid="sortormatch-feedback" role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${result ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
            <p className="font-bold">{result ? "Correct" : "Not quite"}</p>
            {block.why && <p className="mt-0.5 text-foreground">{block.why}</p>}
            {!result && block.mode === "order" && (
              <p className="mt-0.5 text-foreground">Right order: {block.items.map((i) => i.label).join(" , ")}</p>
            )}
          </div>
        )}
      </div>
    </BlockFrame>
  );
}
