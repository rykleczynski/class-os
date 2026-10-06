"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceDot,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartBlock } from "@/lib/lesson/schema";
import { BlockFrame, SERIES_COLORS, useMounted, type BlockProps } from "./shared";

export function Chart({ block }: BlockProps<ChartBlock>) {
  const mounted = useMounted();
  const ys = Array.isArray(block.y) ? block.y : [block.y];
  const common = { data: block.data, margin: { top: 8, right: 12, bottom: 8, left: 0 } };
  const axes = (
    <>
      <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
      <XAxis
        dataKey={block.x}
        type={block.kind === "scatter" ? "number" : "category"}
        stroke="var(--muted-foreground)"
        fontSize={12}
        label={block.xLabel ? { value: block.xLabel, position: "insideBottom", offset: -4, fontSize: 12 } : undefined}
        height={block.xLabel ? 40 : 28}
      />
      <YAxis
        stroke="var(--muted-foreground)"
        fontSize={12}
        width={48}
        label={block.yLabel ? { value: block.yLabel, angle: -90, position: "insideLeft", fontSize: 12 } : undefined}
      />
      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
    </>
  );
  const marks = (block.annotations ?? []).map((a, i) => {
    const row = block.data.find((r) => r[block.x] === a.x);
    const y = a.y ?? (row ? Number(row[ys[0]]) : undefined);
    if (y === undefined) return null;
    return (
      <ReferenceDot
        key={i}
        x={a.x}
        y={y}
        r={5}
        fill="var(--check)"
        stroke="var(--paper-card)"
        label={{ value: a.label, position: "top", fontSize: 12, fill: "var(--foreground)" }}
      />
    );
  });

  let chart;
  if (block.kind === "bar") {
    chart = (
      <BarChart {...common}>
        {axes}
        {ys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={SERIES_COLORS[i % 5]} radius={[6, 6, 0, 0]} />
        ))}
      </BarChart>
    );
  } else if (block.kind === "area") {
    chart = (
      <AreaChart {...common}>
        {axes}
        {ys.map((k, i) => (
          <Area key={k} dataKey={k} stroke={SERIES_COLORS[i % 5]} fill={SERIES_COLORS[i % 5]} fillOpacity={0.2} />
        ))}
        {marks}
      </AreaChart>
    );
  } else if (block.kind === "scatter") {
    chart = (
      <ScatterChart margin={common.margin}>
        {axes}
        {ys.map((k, i) => (
          <Scatter key={k} data={block.data} dataKey={k} fill={SERIES_COLORS[i % 5]} />
        ))}
      </ScatterChart>
    );
  } else {
    chart = (
      <LineChart {...common}>
        {axes}
        {ys.map((k, i) => (
          <Line key={k} dataKey={k} stroke={SERIES_COLORS[i % 5]} strokeWidth={2.5} dot={false} />
        ))}
        {marks}
      </LineChart>
    );
  }

  return (
    <BlockFrame title={block.title} caption={block.caption}>
      <div className="h-64 w-full" role="img" aria-label={block.title ?? "Chart"}>
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        )}
      </div>
    </BlockFrame>
  );
}
