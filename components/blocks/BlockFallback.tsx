import { TriangleAlert } from "lucide-react";

export function BlockFallback({ title, detail }: { title: string; detail?: string }) {
  return (
    <div role="alert" data-testid="block-fallback" className="flex gap-3 rounded-2xl border border-dashed border-bad/60 bg-bad-soft p-3 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-bad">{title}</p>
        <p className="text-muted-foreground">The rest of the lesson is unaffected.</p>
        {detail && <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={detail}>{detail}</p>}
      </div>
    </div>
  );
}
