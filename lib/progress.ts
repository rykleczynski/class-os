"use client";

import { useSyncExternalStore } from "react";

/**
 * Local-only progress (localStorage, per browser), keyed by lesson slug everywhere.
 * Stored under one versioned key. Older completed-only ids (`classos:completed`)
 * are migrated in when read. Every storage access is guarded: when storage is
 * unavailable progress simply is not saved.
 */
const KEY = "classos:progress:v1";
const LEGACY_KEY = "classos:completed"; // plain array of completed lesson slugs
const EVENT = "classos:progress";

export type LessonProgress = {
  /** Furthest step index reached: steps, then quiz, then flashcards. */
  maxStep: number;
  /** Where the learner was last. The player resumes here. */
  lastStep: number;
  quizScore?: number;
  quizTotal?: number;
  completedAt?: number;
  updatedAt: number;
};
export type ProgressMap = Record<string, LessonProgress>;

export const isDone = (p?: LessonProgress) => p?.completedAt !== undefined;

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function load(): ProgressMap {
  const map: ProgressMap = {};
  try {
    for (const id of JSON.parse(readRaw(LEGACY_KEY) ?? "[]") as string[]) map[id] = { maxStep: 0, lastStep: 0, completedAt: 0, updatedAt: 0 };
  } catch {
    /* ignore corrupt legacy value */
  }
  try {
    Object.assign(map, JSON.parse(readRaw(KEY) ?? "{}") as ProgressMap);
  } catch {
    /* ignore corrupt value */
  }
  return map;
}

function update(slug: string, fn: (p: LessonProgress | undefined) => LessonProgress | undefined) {
  try {
    const map = load();
    const next = fn(map[slug]);
    if (next) map[slug] = next;
    else delete map[slug];
    localStorage.setItem(KEY, JSON.stringify(map));
    // load() folded the legacy ids into `map`, so drop the old key. Otherwise a
    // reset would see the old completion again.
    localStorage.removeItem(LEGACY_KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable: progress simply is not saved */
  }
}

const blank = (): LessonProgress => ({ maxStep: 0, lastStep: 0, updatedAt: Date.now() });

/** Record the step the learner is on now. maxStep never moves backwards. */
export function recordStep(slug: string, step: number) {
  update(slug, (p) => ({ ...(p ?? blank()), lastStep: step, maxStep: Math.max(p?.maxStep ?? 0, step), updatedAt: Date.now() }));
}

export function recordQuizScore(slug: string, score: number, total: number) {
  update(slug, (p) => ({ ...(p ?? blank()), quizScore: score, quizTotal: total, updatedAt: Date.now() }));
}

export function markCompleted(slug: string) {
  update(slug, (p) => ({ ...(p ?? blank()), completedAt: Date.now(), updatedAt: Date.now() }));
}

/** Forget everything about a lesson ("Start over"). */
export function resetProgress(slug: string) {
  update(slug, () => undefined);
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** The server snapshot is "" so callers can render a skeleton until mounted. */
const snapshot = () => `${readRaw(KEY) ?? ""}|${readRaw(LEGACY_KEY) ?? ""}|`;

/** Progress for all lessons. `ready` is false on the server and during hydration. */
export function useProgress(): { ready: boolean; map: ProgressMap } {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return { ready: raw !== "", map: raw === "" ? {} : load() };
}

export function useCompletedIds(): string[] {
  const { map } = useProgress();
  return Object.entries(map).filter(([, p]) => isDone(p)).map(([id]) => id);
}
