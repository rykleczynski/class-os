import type { SupplyDemandBlock } from "./schema";

export type Line = { label: string; kind: "supply" | "demand" | "other"; intercept: number; slope: number; color?: string; shifted: boolean };
export type Equilibrium = { name: string; q: number; p: number; supply: string; demand: string };

export const priceAt = (l: Pick<Line, "intercept" | "slope">, q: number) => l.intercept + l.slope * q;

export function intersect(a: Pick<Line, "intercept" | "slope">, b: Pick<Line, "intercept" | "slope">) {
  if (a.slope === b.slope) return null;
  const q = (a.intercept - b.intercept) / (b.slope - a.slope);
  if (!(q >= 0)) return null;
  return { q, p: priceAt(a, q) };
}

export function buildLines(block: SupplyDemandBlock): Line[] {
  const base: Line[] = block.curves.map((c) => ({ ...c, shifted: false }));
  const shifted: Line[] = (block.shifts ?? []).flatMap((s) => {
    const from = base.find((c) => c.label === s.of);
    if (!from) return [];
    return [{
      label: s.label,
      kind: from.kind,
      intercept: s.intercept ?? from.intercept,
      slope: s.slope ?? from.slope,
      color: s.color ?? from.color,
      shifted: true,
    }];
  });
  return [...base, ...shifted];
}

/** Equilibrium of the base pair, plus one per shifted curve against the opposite base curve. */
export function findEquilibria(lines: Line[]): Equilibrium[] {
  const baseS = lines.find((l) => !l.shifted && l.kind === "supply");
  const baseD = lines.find((l) => !l.shifted && l.kind === "demand");
  const out: Equilibrium[] = [];
  const add = (s: Line, d: Line) => {
    const x = intersect(s, d);
    if (x && x.p >= 0) out.push({ name: `E${out.length}`, q: x.q, p: x.p, supply: s.label, demand: d.label });
  };
  if (baseS && baseD) add(baseS, baseD);
  for (const l of lines.filter((l) => l.shifted)) {
    if (l.kind === "supply" && baseD) add(l, baseD);
    if (l.kind === "demand" && baseS) add(baseS, l);
  }
  return out;
}

/** Round up to a 1/2/5 x 10^n number for axis limits. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
