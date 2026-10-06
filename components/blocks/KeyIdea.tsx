import { Lightbulb } from "lucide-react";
import type { KeyIdeaBlock } from "@/lib/lesson/schema";

export function KeyIdea({ block }: { block: KeyIdeaBlock }) {
  return (
    <aside className="flex gap-3 rounded-2xl border border-amber-300/60 bg-amber-100/70 p-4 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50">
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        <p className="text-xs font-bold uppercase tracking-wide opacity-70">Key idea</p>
        <p className="mt-0.5 font-semibold leading-snug">{block.text}</p>
      </div>
    </aside>
  );
}
