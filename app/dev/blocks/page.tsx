"use client";

import Link from "next/link";
import { useState } from "react";
import { BlockRenderer, type BlockOverride } from "@/components/blocks/BlockRenderer";
import { useMounted } from "@/components/blocks/shared";
import { GALLERY } from "@/lib/fixtures/blocks-gallery";

// Error boundaries only catch on the client, so crash after hydration.
const Boom: BlockOverride = () => {
  const mounted = useMounted();
  if (mounted) throw new Error("Deliberate crash from the dev gallery");
  return null;
};

export default function BlocksGallery() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="min-h-dvh bg-paper px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <Link href="/" className="text-sm font-semibold underline underline-offset-2">
            Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold">Block gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every block type, rendered from a fixture. The last two entries fail on purpose; the rest of the page keeps working.
          </p>
        </header>
        {GALLERY.map((g, i) => (
          <section key={i} aria-label={g.label} className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
            {g.note && <p className="text-xs text-muted-foreground">{g.note}</p>}
            <BlockRenderer
              block={g.block}
              stepId="gallery"
              index={i}
              overrides={{ boom: Boom }}
              onAttempt={(id, ans, ok) => setLog((l) => [`${id}: ${JSON.stringify(ans)} -> ${ok ? "correct" : "wrong"}`, ...l].slice(0, 5))}
            />
          </section>
        ))}
        <section aria-label="attempt log" className="rounded-2xl border border-dashed border-paper-border p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">onAttempt log</h2>
          <pre data-testid="attempt-log" className="mt-1 whitespace-pre-wrap font-mono text-xs">{log.length ? log.join("\n") : "(no attempts yet)"}</pre>
        </section>
      </div>
    </div>
  );
}
