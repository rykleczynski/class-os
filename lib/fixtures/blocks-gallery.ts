/**
 * One fixture per block type, plus two deliberate failures used by /dev/blocks
 * to prove the fallbacks: an invalid block and a block whose component throws.
 */
export type GalleryEntry = { label: string; note?: string; block: unknown };

const cashFlows = Array.from({ length: 6 }, (_, t) => ({ year: `Y${t}`, cash: t === 0 ? -1000 : 300 }));

export const GALLERY: GalleryEntry[] = [
  { label: "prose", block: { type: "prose", md: "Prose supports **bold**, *italic*, `code`, [links](https://example.com), lists:\n\n- one\n- two\n\n> and quotes from the professor." } },
  { label: "keyIdea", block: { type: "keyIdea", text: "A highlighted takeaway, one sentence." } },
  { label: "chart (line)", block: { type: "chart", kind: "line", title: "Cash by year", data: cashFlows, x: "year", y: "cash", xLabel: "Year", yLabel: "Cash ($)", annotations: [{ x: "Y0", label: "Outlay" }] } },
  { label: "chart (bar)", block: { type: "chart", kind: "bar", title: "Cash by year (bar)", data: cashFlows, x: "year", y: "cash" } },
  { label: "chart (area)", block: { type: "chart", kind: "area", title: "Cash by year (area)", data: cashFlows, x: "year", y: "cash" } },
  { label: "chart (scatter)", block: { type: "chart", kind: "scatter", title: "Scatter", data: [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 3 }, { x: 4, y: 7 }], x: "x", y: "y" } },
  { label: "slider with plot", block: { type: "slider", id: "g-slider", title: "PV of $1,000 vs years and rate", formula: "1000/(1+r/100)^t", vars: [{ name: "r", label: "Rate", min: 0, max: 20, step: 0.5, default: 7, unit: "%" }, { name: "t", label: "Years", min: 0, max: 30, step: 1, default: 10 }], output: { label: "Present value", format: "currency", decimals: 2 }, plot: { x: "t", range: [0, 30], yLabel: "PV ($)", zeroLine: false } } },
  { label: "supplyDemand (tax, deadweight loss)", block: { type: "supplyDemand", title: "A $20 tax shifts supply up", curves: [{ label: "Demand", kind: "demand", intercept: 100, slope: -1 }, { label: "Supply", kind: "supply", intercept: 10, slope: 1 }], shifts: [{ of: "Supply", label: "Supply + tax", intercept: 30 }], areas: [{ label: "DWL", curves: ["Demand", "Supply"], from: 35, to: 45 }], xLabel: "Quantity", yLabel: "Price ($)", caption: "Equilibria are computed, not typed in." } },
  { label: "timeline (cash flows)", block: { type: "timeline", title: "Cash flows", events: [{ when: "Today", title: "Pay", amount: -100000 }, { when: "Year 1", title: "Receive", amount: 105000 }] } },
  { label: "compare", block: { type: "compare", columns: ["Pareto", "Kaldor-Hicks"], highlight: 1, rows: [{ label: "Needs", cells: ["No one worse off", "Winners could compensate losers"] }, { label: "Strictness", cells: ["Very strict", "Looser"] }] } },
  { label: "stepper", block: { type: "stepper", title: "Compound once", frames: [{ title: "Start", text: "You have $100.", math: "100" }, { title: "Grow", text: "7% for a year.", math: "100 x 1.07 = 107" }] } },
  { label: "flip", block: { type: "flip", front: "What is NPV?", back: "A bucket of cash today." } },
  { label: "mcq", block: { type: "mcq", id: "g-mcq", q: "2 + 2 = ?", options: ["3", "4", "5"], answer: 1, why: "Arithmetic." } },
  { label: "sortOrMatch (order)", block: { type: "sortOrMatch", id: "g-order", mode: "order", prompt: "Put these in order.", items: [{ label: "First" }, { label: "Second" }, { label: "Third" }], why: "Order matters." } },
  { label: "sortOrMatch (match)", block: { type: "sortOrMatch", id: "g-match", mode: "match", prompt: "Match each to its kind.", targets: ["Fruit", "Vegetable"], items: [{ label: "Apple", target: 0 }, { label: "Carrot", target: 1 }], why: "Botany." } },
  { label: "scenario", block: { type: "scenario", id: "g-scn", prompt: "A source offers a scoop in exchange for favorable coverage.", choices: [{ label: "Decline and say why", outcome: "Your independence is intact.", verdict: "best" }, { label: "Accept quietly", outcome: "You now owe them.", verdict: "poor" }], debrief: "Independence first." } },
  { label: "inTheNews", block: { type: "inTheNews", headline: "Example headline", source: "Example News", url: "https://example.com/story", date: "2026-10-01", tieIn: "How this connects to the lesson.", placeholder: true } },
  { label: "custom (sandboxed iframe, works)", block: { type: "custom", height: 160, caption: "Inline script only; no allow-same-origin.", html: "<div style='padding:12px'><button id='b' style='padding:8px 12px;border-radius:8px;border:1px solid #999'>Clicked 0 times</button></div><script>var n=0;document.getElementById('b').onclick=function(){n++;this.textContent='Clicked '+n+' times'}</script>" } },
  { label: "INVALID block (fails safeParse)", note: "Missing required fields. Expect a fallback card.", block: { type: "mcq", q: "No options and no answer" } },
  { label: "custom block that throws", note: "Rendered with a component override that throws. Expect a fallback card.", block: { type: "custom", id: "boom", height: 120, html: "<p>never shown</p>" } },
];
