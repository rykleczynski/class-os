"use client";

import { useSyncExternalStore } from "react";

/**
 * Local-only progress until attempts are persisted (localStorage, per browser).
 * Per lesson we keep the furthest step index reached (steps, then quiz, then
 * flashcards), a completed flag, and the quiz score. Every storage access is
 * guarded: when storage is unavailable progress simply is not saved.
 */
const KEY = "classos:lessons";
const LEGACY_KEY = "classos:completed"; // plain array of completed lesson ids
const EVENT = "classos:progress";

export type LessonProgress = { step: number; done: boolean; score?: number; total?: number };
export type ProgressMap = Record<string, LessonProgress>;

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
    for (const id of JSON.parse(readRaw(LEGACY_KEY) ?? "[]") as string[]) map[id] = { step: 0, done: true };
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

function update(lessonId: string, fn: (p: LessonProgress) => LessonProgress) {
  try {
    const map = load();
    const next = fn(map[lessonId] ?? { step: 0, done: false });
    map[lessonId] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable: progress simply is not saved */
  }
}

/** Remember the furthest step index the learner has reached. Never moves backwards. */
export function recordStep(lessonId: string, step: number) {
  update(lessonId, (p) => (step > p.step ? { ...p, step } : p));
}

export function recordQuizScore(lessonId: string, score: number, total: number) {
  update(lessonId, (p) => ({ ...p, score, total }));
}

export function markCompleted(lessonId: string) {
  update(lessonId, (p) => ({ ...p, done: true }));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** Snapshot string. The server snapshot is "" so callers can render a skeleton until mounted. */
const snapshot = () => `${readRaw(KEY) ?? ""}|${readRaw(LEGACY_KEY) ?? ""}|`;

/** Progress for all lessons. `ready` is false on the server and during hydration. */
export function useProgress(): { ready: boolean; map: ProgressMap } {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const map = raw === "" ? {} : load();
  return { ready: raw !== "", map };
}

export function useCompletedIds(): string[] {
  const { map } = useProgress();
  return Object.entries(map).filter(([, p]) => p.done).map(([id]) => id);
}
