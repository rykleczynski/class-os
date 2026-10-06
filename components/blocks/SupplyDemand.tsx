"use client";

import type { SupplyDemandBlock } from "@/lib/lesson/schema";
import { buildLines, findEquilibria, niceMax, priceAt, type Line } from "@/lib/lesson/supply-demand";
import { BlockFrame, SERIES_COLORS, type BlockProps } from "./shared";

const W = 520;
const H = 340;
const M = { top: 16, right: 24, bottom: 44, left: 52 };

export function SupplyDemand({ block }: BlockProps<SupplyDemandBlock>) {
  const lines = buildLines(block);
  const eqs = findEquilibria(lines);

  const xMax = block.xMax ?? niceMax(Math.max(...eqs.map((e) => e.q), 0) * 1.8 || 100);
  const yMax = block.yMax ?? niceMax(Math.max(...eqs.map((e) => e.p), 0) * 1.7 || 100);
  const sx = (q: number) => M.left + (q / xMax) * (W - M.left - M.right);
  const sy = (p: number) => H - M.bottom - (p / yMax) * (H - M.top - M.bottom);

  const colorOf = (l: Line, i: number) =>
    l.color ?? (l.kind === "demand" ? "var(--chart-1)" : l.kind === "supply" ? "var(--chart-2)" : SERIES_COLORS[(i + 2) % 5]);

  // Clip each line to the plot box.
  const segment = (l: Line) => {
    let q0 = 0;
    let q1 = xMax;
    if (l.slope !== 0) {
      const qAt0 = (0 - l.intercept) / l.slope;
      const qAtMax = (yMax - l.intercept) / l.slope;
      const lo = Math.min(qAt0, qAtMax);
      const hi = Math.max(qAt0, qAtMax);
      q0 = Math.max(q0, lo);
      q1 = Math.min(q1, hi);
    }
    return { q0, q1 };
  };

  const find = (label: string) => lines.find((l) => l.label === label);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <BlockFrame title={block.title} caption={block.caption}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={block.title ?? "Supply and demand diagram"}>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" strokeDasharray="3 3" />
            <text x={M.left - 8} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">{fmt(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={H - M.bottom + 16} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{fmt(t)}</text>
        ))}
        <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} stroke="var(--muted-foreground)" />
        <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--muted-foreground)" />
        <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--foreground)">{block.xLabel ?? "Quantity"}</text>
        <text transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--foreground)">{block.yLabel ?? "Price"}</text>

        {(block.areas ?? []).map((a, i) => {
          const c1 = find(a.curves[0]);
          const c2 = find(a.curves[1]);
          if (!c1 || !c2) return null;
          const pts = [
            [a.from, priceAt(c1, a.from)],
            [a.to, priceAt(c1, a.to)],
            [a.to, priceAt(c2, a.to)],
            [a.from, priceAt(c2, a.from)],
          ];
          const cx = pts.reduce((s, p) => s + p[0], 0) / 4;
          const cy = pts.reduce((s, p) => s + p[1], 0) / 4;
          const color = a.color ?? "var(--check)";
          return (
            <g key={`a${i}`}>
              <polygon points={pts.map(([q, p]) => `${sx(q)},${sy(p)}`).join(" ")} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1} />
              <text x={sx(cx)} y={sy(cy) + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--foreground)">{a.label}</text>
            </g>
          );
        })}

        {lines.map((l, i) => {
          const { q0, q1 } = segment(l);
          if (q1 <= q0) return null;
          const color = colorOf(l, i);
          return (
            <g key={l.label}>
              <line x1={sx(q0)} y1={sy(priceAt(l, q0))} x2={sx(q1)} y2={sy(priceAt(l, q1))} stroke={color} strokeWidth={3} strokeLinecap="round" strokeDasharray={l.shifted ? "7 5" : undefined} />
              <text
                x={Math.min(sx(q1) + 4, W - M.right - 2)}
                y={sy(priceAt(l, q1)) + (l.slope >= 0 ? -6 : 14)}
                textAnchor="end"
                fontSize={12}
                fontWeight={700}
                fill={color}
              >
                {l.label}
              </text>
            </g>
          );
        })}

        {eqs.map((e) => (
          <g key={e.name}>
            <line x1={sx(e.q)} y1={sy(e.p)} x2={sx(e.q)} y2={H - M.bottom} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <line x1={M.left} y1={sy(e.p)} x2={sx(e.q)} y2={sy(e.p)} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <circle cx={sx(e.q)} cy={sy(e.p)} r={6} fill="var(--foreground)" stroke="var(--paper-card)" strokeWidth={2} />
            <text x={sx(e.q) + 9} y={sy(e.p) - 8} fontSize={12} fontWeight={700} fill="var(--foreground)">
              {e.name} ({fmt(Number(e.q.toFixed(2)))}, {fmt(Number(e.p.toFixed(2)))})
            </text>
          </g>
        ))}
      </svg>
    </BlockFrame>
  );
}
