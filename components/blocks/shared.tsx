"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { OnAttempt } from "@/lib/lesson/schema";

/** True after hydration. Used to hold back chart libraries that need real layout. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export type BlockProps<T> = {
  block: T;
  blockId: string;
  onAttempt?: OnAttempt;
};

export function BlockFrame({
  title,
  caption,
  children,
  className = "",
}: {
  title?: string;
  caption?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`rounded-2xl border border-paper-border bg-paper-card p-4 sm:p-5 ${className}`}>
      {title && <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>}
      {children}
      {caption && <p className="mt-3 text-xs text-muted-foreground">{caption}</p>}
    </figure>
  );
}

export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function formatValue(
  v: number,
  format: "number" | "currency" | "percent" = "number",
  decimals?: number,
): string {
  if (!Number.isFinite(v)) return "n/a";
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: decimals ?? 0,
      minimumFractionDigits: decimals ?? 0,
    }).format(v);
  }
  if (format === "percent") return `${v.toFixed(decimals ?? 1)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals ?? 2 }).format(v);
}

export function compactNumber(v: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}
