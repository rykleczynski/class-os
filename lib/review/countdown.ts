"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const nowSec = () => Math.floor(Date.now() / 1000);
const idle = () => () => {};

/**
 * A pausable countdown that runs off an end timestamp, so it keeps counting while the component showing it is
 * unmounted. The review page holds this above the tabs; it changes only on start, pause and reset, so holding
 * it re-renders nothing per second. Read the seconds left with useTimeLeft, inside the component that shows them.
 * Not persisted: a reload starts over.
 */
export function useCountdown(minutes: number) {
  const [s, setS] = useState<{ total: number; endsAt: number | null; left: number }>({ total: minutes * 60, endsAt: null, left: minutes * 60 });
  const start = useCallback(() => setS((p) => (p.endsAt === null && p.left > 0 ? { ...p, endsAt: nowSec() + p.left } : p)), []);
  const pause = useCallback(() => setS((p) => (p.endsAt === null ? p : { ...p, endsAt: null, left: Math.max(0, p.endsAt - nowSec()) })), []);
  /** Stops and refills the clock; pass minutes to switch to an exam of a different length. */
  const reset = useCallback((nextMinutes?: number) => setS((p) => {
    const total = nextMinutes ? nextMinutes * 60 : p.total;
    return { total, endsAt: null, left: total };
  }), []);
  return { total: s.total, endsAt: s.endsAt, pausedLeft: s.left, start, pause, reset };
}

export type Countdown = ReturnType<typeof useCountdown>;

/** Seconds left, re-rendering the caller once a second while running. The tick stops at zero. */
export function useTimeLeft(c: Countdown): { left: number; running: boolean } {
  const { endsAt } = c;
  const subscribe = useCallback(
    (cb: () => void) => {
      if (endsAt === null) return idle();
      const t = setInterval(() => {
        cb();
        if (nowSec() >= endsAt) clearInterval(t);
      }, 1000);
      return () => clearInterval(t);
    },
    [endsAt],
  );
  const now = useSyncExternalStore(subscribe, nowSec, () => null);
  const left = endsAt === null || now === null ? c.pausedLeft : Math.max(0, endsAt - now);
  return { left, running: endsAt !== null && left > 0 };
}
