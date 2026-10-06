import type { TimelineBlock } from "@/lib/lesson/schema";
import { BlockFrame, formatValue, type BlockProps } from "./shared";

export function Timeline({ block }: BlockProps<TimelineBlock>) {
  return (
    <BlockFrame title={block.title} caption={block.caption}>
      <ol className="relative flex gap-0 overflow-x-auto pb-2 sm:overflow-visible">
        {block.events.map((e, i) => {
          const hasAmount = typeof e.amount === "number";
          const positive = (e.amount ?? 0) >= 0;
          return (
            <li key={i} className="relative min-w-[8.5rem] flex-1 pr-3">
              <div className="flex items-center">
                <span
                  className={`z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-paper-card ring-2 ${
                    hasAmount ? (positive ? "bg-good ring-good" : "bg-bad ring-bad") : "bg-foreground ring-foreground"
                  }`}
                />
                {i < block.events.length - 1 && <span className="h-0.5 flex-1 bg-border" />}
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{e.when}</p>
              <p className="text-sm font-semibold leading-snug">{e.title}</p>
              {hasAmount && (
                <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${positive ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
                  {positive ? "+" : "-"}
                  {formatValue(Math.abs(e.amount!), "currency")}
                </p>
              )}
              {e.detail && <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>}
            </li>
          );
        })}
      </ol>
    </BlockFrame>
  );
}
