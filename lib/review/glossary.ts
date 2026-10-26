import type { NotesBuilder } from "./schema";

export type GlossaryEntry = NotesBuilder["glossary"][number];
export type Segment = { text: string; entry?: GlossaryEntry };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordy = (c: string) => /\w/.test(c);

/**
 * The meaning cut to its name, for spelling a term out inside a line: "Annual percentage rate: the QUOTED yearly
 * rate..." becomes "Annual percentage rate". Cuts at the first ": ", " = " or ". " outside brackets, so
 * "Periods per year (12 = monthly, 2 = semiannual)" stays whole.
 */
export function shortMeaning(e: GlossaryEntry): string {
  let depth = 0;
  for (let i = 0; i < e.meaning.length; i++) {
    const c = e.meaning[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && /^(: | = |\. )/.test(e.meaning.slice(i, i + 3))) return e.meaning.slice(0, i).trim();
  }
  return e.meaning.trim();
}

/**
 * Builds a matcher for a glossary: longest spelling first, so "YTM_n" wins over "YTM". A spelling only needs a
 * token boundary on an edge that is an ASCII letter, digit or underscore, so "Δ" and "AR" both match in "ΔAR".
 */
export function glossaryMatcher(glossary: GlossaryEntry[]) {
  const bySpelling = new Map<string, GlossaryEntry>();
  for (const e of glossary) for (const s of [e.term, ...e.aka]) if (!bySpelling.has(s)) bySpelling.set(s, e);
  const spellings = [...bySpelling.keys()].sort((a, b) => b.length - a.length);
  // An apostrophe joins a token too, so "t" does not match the end of "don't".
  const pattern = spellings.map((s) => `${wordy(s[0]) ? "(?<![\\w'])" : ""}${escape(s)}${wordy(s[s.length - 1]) ? "(?![\\w'])" : ""}`).join("|");
  const re = pattern ? new RegExp(pattern, "gu") : null;

  /** Splits a line into plain text and glossary terms, in order. */
  function segments(text: string): Segment[] {
    if (!re) return [{ text }];
    const out: Segment[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      out.push({ text: m[0], entry: bySpelling.get(m[0]) });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }

  /** The distinct entries a line uses, in order of first use. */
  function termsIn(text: string): GlossaryEntry[] {
    return [...new Set(segments(text).flatMap((s) => (s.entry ? [s.entry] : [])))];
  }

  return { segments, termsIn };
}
