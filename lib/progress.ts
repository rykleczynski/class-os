"use client";

import { useSyncExternalStore } from "react";

/** Local-only progress until attempts are persisted. Stores completed lesson ids. */
const KEY = "classos:completed";
const EVENT = "classos:progress";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function markCompleted(lessonId: string) {
  try {
    const set = new Set<string>(JSON.parse(read()));
    set.add(lessonId);
    localStorage.setItem(KEY, JSON.stringify([...set]));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable: progress simply is not saved */
  }
}

export function useCompletedIds(): string[] {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
