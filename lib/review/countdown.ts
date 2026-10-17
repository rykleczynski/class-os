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
  const total = minutes * 60;
  const [s, setS] = useState<{ endsAt: number | null; left: number }>({ endsAt: null, left: total });
  const start = useCallback(() => setS((p) => (p.endsAt === null && p.left > 0 ? { endsAt: nowSec() + p.left, left: p.left } : p)), []);
  const pause = useCallback(() => setS((p) => (p.endsAt === null ? p : { endsAt: null, left: Math.max(0, p.endsAt - nowSec()) })), []);
  const reset = useCallback(() => setS({ endsAt: null, left: total }), [total]);
  return { total, endsAt: s.endsAt, pausedLeft: s.left, start, pause, reset };
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
