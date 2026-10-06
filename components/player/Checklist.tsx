import { Check } from "lucide-react";

export type ChecklistItem = { id: string; title: string };

/** Vertical checklist: coral check circles when done, empty circles ahead, joined by a hairline. */
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
          <li key={it.id} className="relative flex items-start gap-3 pb-5 last:pb-0">
            {i < items.length - 1 && (
              <span aria-hidden className="absolute left-[11px] top-[1.625rem] h-[calc(100%-1.75rem)] w-px bg-paper-border" />
            )}
            <span
              data-testid={`check-${i}`}
              data-done={done}
              className={`z-10 mt-px flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                done ? "border-check bg-check text-coral-foreground" : isCurrent ? "border-foreground bg-paper-card" : "border-control bg-paper-card"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : isCurrent ? <span className="h-2 w-2 rounded-full bg-foreground" aria-hidden /> : null}
              <span className="sr-only">{done ? "Done" : isCurrent ? "Current" : "Not started"}</span>
            </span>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onJump(i)}
              aria-current={isCurrent ? "step" : undefined}
              className={`pt-0.5 text-left text-sm leading-snug ${isCurrent || done ? "font-semibold" : "font-normal"} ${reachable ? "hover:underline hover:underline-offset-4" : "text-muted-foreground"}`}
            >
              {it.title}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
