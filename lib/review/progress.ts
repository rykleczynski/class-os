"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Local-only review state (localStorage, per browser), one key per review: self-check ticks, practice-exam
 * drafts and self-scores. Every storage access is guarded. When a save fails (storage blocked or full) the edit
 * is kept as a pending change and replayed over whatever is stored, so edits keep working, the page can warn,
 * and other tabs' saved work is never overwritten by a stale copy.
 */
export type ReviewState = {
  /** Self-check item keys ("<sectionId>:<item text>") ticked as "I can do this". */
  can: string[];
  /** Practice-exam drafts by "<questionId>:<part label>". */
  answers: Record<string, string>;
  /** Points awarded to yourself by "<questionId>:<part label>", after revealing the solution. */
  scores: Record<string, number>;
};

/** Changes not yet saved. null deletes a key; for `can`, true ticks and false unticks. */
export type Pending = { can: Record<string, boolean>; answers: Record<string, string | null>; scores: Record<string, number | null> };

const EVENT = "classos:review";
const empty: ReviewState = { can: [], answers: {}, scores: {} };
export const reviewKey = (slug: string) => `classos:review:${slug}`;

function diffRecord<T>(a: Record<string, T>, b: Record<string, T>): Record<string, T | null> {
  const out: Record<string, T | null> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) out[k] = k in b ? b[k] : null;
  return out;
}

function applyRecord<T>(base: Record<string, T>, changes: Record<string, T | null>): Record<string, T> {
  const out = { ...base };
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

/** What changed from a to b. */
export function diffState(a: ReviewState, b: ReviewState): Pending {
  const was = new Set(a.can);
  const now = new Set(b.can);
  const can: Record<string, boolean> = {};
  for (const k of now) if (!was.has(k)) can[k] = true;
  for (const k of was) if (!now.has(k)) can[k] = false;
  return { can, answers: diffRecord(a.answers, b.answers), scores: diffRecord(a.scores, b.scores) };
}

/** Later changes win per key. */
export const mergePending = (a: Pending, b: Pending): Pending => ({
  can: { ...a.can, ...b.can },
  answers: { ...a.answers, ...b.answers },
  scores: { ...a.scores, ...b.scores },
});

export function applyPending(s: ReviewState, p: Pending): ReviewState {
  const can = new Set(s.can);
  for (const [k, on] of Object.entries(p.can)) {
    if (on) can.add(k);
    else can.delete(k);
  }
  return { can: [...can], answers: applyRecord(s.answers, p.answers), scores: applyRecord(s.scores, p.scores) };
}

const stored = new Map<string, { raw: string | null; state: ReviewState }>();
/** Pending changes for keys whose last save failed. Lost on reload, which the page warns about. */
const pending = new Map<string, Pending>();
const applied = new Map<string, { base: ReviewState; p: Pending; state: ReviewState }>();

function readStored(key: string): ReviewState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    /* storage unavailable */
  }
  const hit = stored.get(key);
  if (hit && hit.raw === raw) return hit.state; // stable snapshot for useSyncExternalStore
  let state = empty;
  try {
    const v = JSON.parse(raw ?? "null") as Partial<ReviewState> | null;
    if (v) state = { can: Array.isArray(v.can) ? v.can : [], answers: v.answers ?? {}, scores: v.scores ?? {} };
  } catch {
    /* corrupt value: start fresh */
  }
  stored.set(key, { raw, state });
  return state;
}

function read(key: string): ReviewState {
  const base = readStored(key);
  const p = pending.get(key);
  if (!p) return base;
  const hit = applied.get(key);
  if (hit && hit.base === base && hit.p === p) return hit.state;
  const state = applyPending(base, p);
  applied.set(key, { base, p, state });
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
  const persistent = useSyncExternalStore(subscribe, () => !pending.has(key), () => true);
  const update = useCallback(
    (fn: (s: ReviewState) => ReviewState) => {
      const current = read(key);
      const changes = mergePending(pending.get(key) ?? { can: {}, answers: {}, scores: {} }, diffState(current, fn(current)));
      try {
        // Replay onto what is stored now, not onto this tab's copy, so another tab's saves survive.
        localStorage.setItem(key, JSON.stringify(applyPending(readStored(key), changes)));
        pending.delete(key);
      } catch {
        pending.set(key, changes); // not saved, but the edit still shows
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  /** False while a save has failed: the page warns that progress will not survive a reload. */
  return { state, update, persistent };
}
