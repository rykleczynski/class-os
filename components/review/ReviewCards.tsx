"use client";

import { useState } from "react";
import { Flashcards } from "@/components/player/Flashcards";
import type { Review } from "@/lib/review/schema";

export function ReviewCards({ review }: { review: Review }) {
  const [filter, setFilter] = useState<string | null>(null);
  const cards = review.flashcards.filter((c) => !filter || c.sectionId === filter);
  const chip = (on: boolean) =>
    `min-h-9 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-control"}`;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Flashcards</h1>
        <p className="mt-1 text-sm text-muted-foreground">{review.flashcards.length} cards across every topic. Tap a card to flip it.</p>
      </header>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setFilter(null)} className={chip(filter === null)}>
          All
        </button>
        {review.sections.map((s) => (
          <button key={s.id} type="button" onClick={() => setFilter(s.id)} className={chip(filter === s.id)}>
            {s.title}
          </button>
        ))}
      </div>
      {/* Remount on filter change so the deck restarts at card 1. */}
      <Flashcards key={filter ?? "all"} cards={cards} />
    </div>
  );
}
