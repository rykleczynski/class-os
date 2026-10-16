"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Local-only review state (localStorage, per browser), one key per review: self-check ticks, practice-exam
 * drafts and self-scores. Every storage access is guarded; when storage is unavailable nothing is saved.
 */
export type ReviewState = {
  /** Self-check item keys ("<sectionId>:<item text>") ticked as "I can do this". */
  can: string[];
  /** Practice-exam drafts by "<questionId>:<partIndex>". */
  answers: Record<string, string>;
  /** Points awarded to yourself by "<questionId>:<partIndex>", after revealing the solution. */
  scores: Record<string, number>;
};

const EVENT = "classos:review";
const empty: ReviewState = { can: [], answers: {}, scores: {} };
export const reviewKey = (slug: string) => `classos:review:${slug}`;

const cache = new Map<string, { raw: string | null; state: ReviewState }>();

function read(key: string): ReviewState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    /* storage unavailable */
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.state; // stable snapshot for useSyncExternalStore
  let state = empty;
  try {
    const v = JSON.parse(raw ?? "null") as Partial<ReviewState> | null;
    if (v) state = { can: Array.isArray(v.can) ? v.can : [], answers: v.answers ?? {}, scores: v.scores ?? {} };
  } catch {
    /* corrupt value: start fresh */
  }
  cache.set(key, { raw, state });
  return state;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useReviewState(slug: string) {
  const key = reviewKey(slug);
  const state = useSyncExternalStore(subscribe, () => read(key), () => empty);
  const update = useCallback(
    (fn: (s: ReviewState) => ReviewState) => {
      try {
        localStorage.setItem(key, JSON.stringify(fn(read(key))));
        window.dispatchEvent(new Event(EVENT));
      } catch {
        /* storage unavailable: not saved */
      }
    },
    [key],
  );
  return { state, update };
}
