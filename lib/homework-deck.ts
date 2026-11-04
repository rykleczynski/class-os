import type { HomeworkModule, HomeworkSpec } from "./homework-spec";

/**
 * The flashcard order for a homework set. Pure, no React: components/homework/Deck.tsx renders
 * these cards and scripts/test-homework-deck.ts checks the order. `key` is stable across renders.
 */
export type DeckCard =
  | { kind: "intro"; key: string; title: string; items: string[] }
  | { kind: "concept"; key: string; title: string; body: string[] }
  | { kind: "problem"; key: string; module: HomeworkModule; setup: string[] }
  | { kind: "finish"; key: string };

/** "4b-1" and "4g" are both group 4; "1" and "12" differ. An id with no leading digits is its own group. */
function questionGroup(id: string): string {
  return /^\d+/.exec(id)?.[0] ?? id;
}

/**
 * Intro when the banner has items, then each module's concept (if any) and problem, then finish.
 * `ctx` is setup shared with the following sub-questions, so each problem carries every distinct
 * `ctx` so far in its question group, in order, including its own.
 */
export function buildDeck(spec: HomeworkSpec): DeckCard[] {
  const deck: DeckCard[] = [];
  if (spec.banner.items.length > 0) {
    deck.push({ kind: "intro", key: "intro", title: spec.banner.title, items: spec.banner.items });
  }
  let group: string | null = null;
  let setup: string[] = [];
  for (const m of spec.modules) {
    const nextGroup = questionGroup(m.id);
    if (nextGroup !== group) {
      group = nextGroup;
      setup = [];
    }
    if (m.ctx && !setup.includes(m.ctx)) setup = [...setup, m.ctx];
    if (m.concept) deck.push({ kind: "concept", key: `concept:${m.id}`, title: m.concept.title, body: m.concept.body });
    deck.push({ kind: "problem", key: `problem:${m.id}`, module: m, setup });
  }
  deck.push({ kind: "finish", key: "finish" });
  return deck;
}

/** Where a remembered card key is now. A key that is missing, stale or junk means the first card. */
export function findCardIndex(deck: DeckCard[], key: string | null): number {
  return Math.max(
    deck.findIndex((card) => card.key === key),
    0,
  );
}
