"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const nowSec = () => Math.floor(Date.now() / 1000);
const tickEverySecond = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
const idle = () => () => {};

/**
 * A pausable countdown that runs off an end timestamp, so it keeps counting while the component showing it is
 * unmounted (the review page holds it above the tabs). Not persisted: a reload starts over.
 */
export function useCountdown(minutes: number) {
  const total = minutes * 60;
  const [s, setS] = useState<{ endsAt: number | null; left: number }>({ endsAt: null, left: total });
  const running = s.endsAt !== null;
  const now = useSyncExternalStore(running ? tickEverySecond : idle, nowSec, () => null);
  const left = s.endsAt === null || now === null ? s.left : Math.max(0, s.endsAt - now);

  const start = useCallback(() => setS((p) => (p.endsAt === null && p.left > 0 ? { endsAt: nowSec() + p.left, left: p.left } : p)), []);
  const pause = useCallback(() => setS((p) => (p.endsAt === null ? p : { endsAt: null, left: Math.max(0, p.endsAt - nowSec()) })), []);
  const reset = useCallback(() => setS({ endsAt: null, left: total }), [total]);
  return { total, left, running, start, pause, reset };
}

export type Countdown = ReturnType<typeof useCountdown>;
