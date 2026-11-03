import type { HomeworkModule, HomeworkSpec } from "./homework-spec";

/**
 * The flashcard order for a homework set. Pure, no React: components/homework/Deck.tsx renders
 * these cards and scripts/test-homework-deck.ts checks the order. `key` is stable across renders.
 */
export type DeckCard =
  | { kind: "intro"; key: string; title: string; items: string[] }
  | { kind: "concept"; key: string; title: string; body: string[] }
  | { kind: "problem"; key: string; module: HomeworkModule }
  | { kind: "finish"; key: string };

/** Intro when the banner has items, then each module's concept (if any) and problem, then finish. */
export function buildDeck(spec: HomeworkSpec): DeckCard[] {
  const deck: DeckCard[] = [];
  if (spec.banner.items.length > 0) {
    deck.push({ kind: "intro", key: "intro", title: spec.banner.title, items: spec.banner.items });
  }
  for (const m of spec.modules) {
    if (m.concept) deck.push({ kind: "concept", key: `concept:${m.id}`, title: m.concept.title, body: m.concept.body });
    deck.push({ kind: "problem", key: `problem:${m.id}`, module: m });
  }
  deck.push({ kind: "finish", key: "finish" });
  return deck;
}

/** A remembered index may be junk or point past a deck that has since shrunk. Junk means the first card. */
export function clampCardIndex(index: number, deckLength: number): number {
  if (!Number.isFinite(index) || deckLength <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), deckLength - 1);
}
