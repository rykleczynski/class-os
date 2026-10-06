"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Lesson } from "@/lib/lesson/schema";
import { Flip } from "@/components/blocks/Flip";

export function Flashcards({ cards }: { cards: Lesson["flashcards"] }) {
  const [i, setI] = useState(0);
  const card = cards[i];
  return (
    <div className="space-y-4" data-testid="flashcards">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Card {i + 1} of {cards.length}
      </p>
      <Flip key={i} block={{ type: "flip", front: card.front, back: card.back }} blockId={`card:${i}`} />
      <div className="flex justify-between">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button type="button" disabled={i === cards.length - 1} onClick={() => setI(i + 1)} className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-40">
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
