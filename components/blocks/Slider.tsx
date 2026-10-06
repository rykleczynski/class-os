"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SliderBlock } from "@/lib/lesson/schema";
import { evalFormula } from "@/lib/lesson/safe-eval";
import { BlockFrame, compactNumber, formatValue, useMounted, type BlockProps } from "./shared";

export function Slider({ block }: BlockProps<SliderBlock>) {
  const mounted = useMounted();
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(block.vars.map((v) => [v.name, v.default])),
  );

  const result = useMemo(() => {
    try {
      return { ok: true as const, value: evalFormula(block.formula, values) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [block.formula, values]);

  const plotVar = block.plot ? block.vars.find((v) => v.name === block.plot!.x) : undefined;
  const series = useMemo(() => {
    if (!block.plot || !plotVar) return [];
    const [lo, hi] = block.plot.range ?? [plotVar.min, plotVar.max];
    const n = block.plot.points ?? 80;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      try {
        const y = evalFormula(block.formula, { ...values, [plotVar.name]: x });
        if (Number.isFinite(y)) pts.push({ x: Number(x.toFixed(6)), y });
      } catch {
        /* skip points that do not evaluate (e.g. divide by zero) */
      }
    }
    return pts;
  }, [block.plot, block.formula, plotVar, values]);

  const unit = (u?: string) => (u ? ` ${u}` : "");
  const out = block.output;

  return (
    <BlockFrame title={block.title} caption={block.caption}>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="space-y-4">
          {block.vars.map((v) => (
            <label key={v.name} className="block">
              <span className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{v.label}</span>
                <span className="font-mono tabular-nums" data-testid={`slider-val-${v.name}`}>
                  {values[v.name]}
                  {unit(v.unit)}
                </span>
              </span>
              <input
                type="range"
                className="mt-1 h-2 w-full cursor-pointer accent-[var(--chart-1)]"
                min={v.min}
                max={v.max}
                step={v.step}
                value={values[v.name]}
                aria-label={v.label}
                onChange={(e) => setValues((s) => ({ ...s, [v.name]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div className="rounded-xl bg-muted px-4 py-3 text-center sm:min-w-40">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{out.label}</p>
          {result.ok ? (
            <p
              data-testid="slider-output"
              className={`text-2xl font-bold tabular-nums ${out.format === "currency" ? (result.value < 0 ? "text-bad" : "text-good") : ""}`}
            >
              {formatValue(result.value, out.format, out.decimals)}
              {out.unit && out.format === "number" ? ` ${out.unit}` : ""}
            </p>
          ) : (
            <p className="text-sm text-bad">Formula error</p>
          )}
        </div>
      </div>

      {block.plot && plotVar && (
        <div className="mt-4 h-56 w-full" role="img" aria-label={`${out.label} versus ${plotVar.label}`}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  label={{ value: `${plotVar.label}${unit(plotVar.unit)}`, position: "insideBottom", offset: -4, fontSize: 12 }}
                  height={40}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  width={56}
                  tickFormatter={(v: number) => compactNumber(v)}
                  label={block.plot.yLabel ? { value: block.plot.yLabel, angle: -90, position: "insideLeft", fontSize: 12 } : undefined}
                />
                <Tooltip
                  formatter={(v) => formatValue(Number(v), out.format, out.decimals)}
                  labelFormatter={(l) => `${plotVar.label}: ${l}${unit(plotVar.unit)}`}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                />
                {block.plot.zeroLine !== false && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
                <Line dataKey="y" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                {result.ok && (
                  <ReferenceDot x={values[plotVar.name]} y={result.value} r={6} fill="var(--check)" stroke="var(--paper-card)" strokeWidth={2} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </BlockFrame>
  );
}
