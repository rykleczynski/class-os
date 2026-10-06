import { Check } from "lucide-react";

export type ChecklistItem = { id: string; title: string };

/** Vertical checklist: red check circles when done, joined by a line. */
export function Checklist({
  items,
  current,
  maxReached,
  onJump,
}: {
  items: ChecklistItem[];
  current: number;
  maxReached: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="relative" aria-label="Lesson steps">
      {items.map((it, i) => {
        const done = i < maxReached && i !== current;
        const isCurrent = i === current;
        const reachable = i <= maxReached;
        return (
          <li key={it.id} className="relative flex gap-3 pb-6 last:pb-0">
            {i < items.length - 1 && (
              <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${i < maxReached ? "bg-check" : "bg-paper-border"}`} />
            )}
            <span
              data-testid={`check-${i}`}
              data-done={done}
              className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                done ? "border-check bg-check text-white" : isCurrent ? "border-foreground bg-paper-card" : "border-paper-border bg-paper-card text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onJump(i)}
              aria-current={isCurrent ? "step" : undefined}
              className={`pt-0.5 text-left text-sm leading-snug ${isCurrent ? "font-bold" : "font-medium"} ${reachable ? "" : "text-muted-foreground"}`}
            >
              {it.title}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
