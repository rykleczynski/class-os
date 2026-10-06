import { Lightbulb } from "lucide-react";
import type { KeyIdeaBlock } from "@/lib/lesson/schema";

export function KeyIdea({ block }: { block: KeyIdeaBlock }) {
  return (
    <aside className="flex gap-3 rounded-2xl border-l-[3px] border-coral bg-paper-card p-4 shadow-soft">
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-coral" strokeWidth={1.75} aria-hidden />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key idea</p>
        <p className="mt-0.5 font-semibold leading-snug">{block.text}</p>
      </div>
    </aside>
  );
}
