import type { ReactNode } from "react";
import type { Review, ReviewSection } from "@/lib/review/schema";
import type { ReviewState } from "@/lib/review/progress";

/** Keyed by text, not position, so ticks survive a rebuild that adds, drops or reorders items. */
export const canKey = (c: { sectionId: string; item: string }) => `${c.sectionId}:${c.item}`;

/** Self-check progress for one section, or for the whole review when sectionId is omitted. */
export function readiness(review: Review, state: ReviewState, sectionId?: string): { done: number; total: number } {
  const keys = review.selfCheck.flatMap((c) => (!sectionId || c.sectionId === sectionId ? [canKey(c)] : []));
  const ticked = new Set(state.can);
  return { done: keys.filter((k) => ticked.has(k)).length, total: keys.length };
}

const WEIGHT_STYLE: Record<ReviewSection["weight"], string> = {
  high: "bg-coral-soft text-coral",
  medium: "bg-warn-soft text-warn",
  low: "bg-muted text-muted-foreground",
};

export function WeightBadge({ weight }: { weight: ReviewSection["weight"] }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${WEIGHT_STYLE[weight]}`}>{weight}</span>;
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-paper-border bg-paper-card p-5 shadow-soft sm:p-6 ${className}`}>
      {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

export function Meter({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs font-semibold text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {done}/{total}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-paper-border" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-check transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const Mono = ({ children }: { children: ReactNode }) => (
  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-paper-border bg-paper px-3 py-2 font-mono text-sm">{children}</pre>
);

export const fmtDate = (date: string) =>
  new Date(`${date}T12:00:00-07:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
