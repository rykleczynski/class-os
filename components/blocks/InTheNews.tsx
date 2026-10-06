import { ExternalLink, Newspaper } from "lucide-react";
import type { InTheNewsBlock } from "@/lib/lesson/schema";
import type { BlockProps } from "./shared";

export function InTheNews({ block }: BlockProps<InTheNewsBlock>) {
  return (
    <aside className="rounded-2xl border border-paper-border bg-paper-card p-4 shadow-soft">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Newspaper className="h-4 w-4" aria-hidden /> In the news
        {block.placeholder && (
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] text-warn">Placeholder, not verified</span>
        )}
      </p>
      <a href={block.url} target="_blank" rel="noopener noreferrer" className="mt-2 block font-semibold leading-snug hover:underline">
        {block.headline} <ExternalLink className="inline h-3.5 w-3.5 align-baseline" aria-hidden />
      </a>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {block.source} · {block.date}
      </p>
      <p className="mt-2 text-[0.95rem] leading-relaxed">{block.tieIn}</p>
    </aside>
  );
}
