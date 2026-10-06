"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import type { FlipBlock } from "@/lib/lesson/schema";
import type { BlockProps } from "./shared";

export function Flip({ block }: BlockProps<FlipBlock>) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      className={`flex min-h-28 w-full flex-col justify-between rounded-2xl border p-4 text-left transition-colors ${
        flipped ? "border-transparent bg-lime text-lime-foreground" : "border-paper-border bg-paper-card"
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wide opacity-60">{flipped ? "Answer" : "Tap to flip"}</span>
      <span className="my-2 text-lg font-semibold leading-snug">{flipped ? block.back : block.front}</span>
      <RotateCw className="h-4 w-4 self-end opacity-50" aria-hidden />
    </button>
  );
}
