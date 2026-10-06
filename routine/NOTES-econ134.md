# Generator notes: ECON 134, 2026-10-05

Notes from turning the Panopto transcript into `econ134-2026-10-05.json`. They are inputs for `routine/PROMPT.md`.

## What worked

- **Pick one numeric model first, then derive everything from it.** The lecture was symbolic (Pi, D, tau, Q first best) with almost no numbers. I fixed MB = 60 - Q and MD = 0.5Q, then every figure follows: Q_FB = 40, Q_M = 60, tau = 20, DWL = 300, revenue = 800, gains from trade = 1200. Recomputing all of them in one `node -e` script caught two of my own arithmetic slips before they reached the JSON. The prompt should require this script.
- **MB vs MD maps cleanly onto `supplyDemand`.** Mark marginal profit as `demand` and marginal damage as `supply`: the equilibrium dot is the social optimum. A tax is a flat `other` curve. A second `other` curve at intercept 0 and slope 0 works as a baseline, so areas can be bounded by the axis.
- **Area triangles are exact only if both bounding curves are straight over [from, to].** The renderer draws a 4-point polygon, so every shaded area here is a triangle, trapezoid or rectangle.
- **Keep the professor's notation but flag the clash.** He uses Q* for the free market. The brief used Q* for the optimum. The lesson says so in one sentence and uses Q_M and Q_FB.
- **Caption errors are systematic.** "Pigouvian" appears as "Peruvian", "provision", "big Vivien", "Pagadian"; Coase as "cost theorem", "Kose", "coast", "cozy"; "Weitzman" survived. A find-and-fix list in the prompt would save time. Mid-sentence "tore" is tau, and "Q for as best" is Q first best.
- **Verbatim quotes need a re-read of the raw lines.** I only quoted lines that appeared intact, fixing only the garbled term.
- **A `scenario` block fits Coase well.** Mark both ownership assignments `best` and the "calculate a tax first" option `poor`. The debrief states the point.

## What was hard

- **The transcript is long (70 KB, ~1,300 lines with timestamps) and the middle is easy to miss.** Strip the timestamp lines first (`grep -v '^[0-9:]*$'`) and read in chunks, because tool output truncates silently.
- **Panopto's topics were three, the lecture had five.** Weitzman prices vs quantities, South Africa's 2019 carbon tax and firm mergers/unitization (Talos and Pemex) also took real time. I folded South Africa and California into the news tie-in and flashcards, and used Talos/Pemex as a match item. Telling the generator to budget for "topics the list omits" would help.
- **Do not repeat the transcript's numbers blindly.** The oil example says SpaceX's IPO raised "$75 million" and "$1 billion" in the same breath; both are auto-caption garbage. I left it out. Rule: if a number cannot be reconciled, drop it.
- **"Holdouts" is not in the lecture.** The brief asked for transaction costs, many parties and holdouts. The professor covered transaction costs, wealth constraints and private information (the $1 or $5M box offered at $4.5M). I used his three and did not attribute "holdout" to him.
- **MCQ length tell.** My first drafts had the correct option longest in 5 of 8 questions. The validator in this repo does not currently warn about it (the brief said it would). I padded distractors to similar lengths and checked with a short script. The tied case (quiz-revenue, 53 vs 53) is not a strict tell.

## Schema and renderer gaps

- `supplyDemand` auto-draws an equilibrium dot for any supply/demand pair and labels it `E0 (q, p)`. No way to rename it ("Social optimum") or hide it.
- Curve and area labels can overlap lines (visible in the revenue figure). An optional label offset would fix it.
- A shifted curve always makes an extra equilibrium. For a tax drawn as a downward shift of MB, that dot lands at the wrong point, so I drew the tax as a flat line instead.
- `slider` has a single output and a single plotted formula. Showing Q and DWL together needs two blocks.
- `inTheNews` has no field for what the source says versus the tie-in. I kept the headline to what the page states (RGGI record price, proceeds above $1 billion, CA-Quebec auction 13% higher) and left the rest to the tie-in text.
- `validate-lesson.ts` has no MCQ-tell check and no check that numbers in captions match the curves. Both would be cheap to add.

## Prompt suggestions for `routine/PROMPT.md`

1. Strip timestamps, read the whole transcript in chunks, list the topics actually covered, and compare with the Panopto list.
2. For quantitative courses, declare a worked numeric model up front and verify every shown number with a script. Print the script output in the PR.
3. Use the professor's examples and exact figures; if the lecture is symbolic, say the numbers are illustrative in each caption.
4. Fix caption errors for domain terms; keep a per-course glossary.
5. Quote only lines that survive intact.
6. Check each MCQ: the correct option should not be strictly longest, and answer indices should vary.
7. News: WebSearch, then WebFetch the URL, and only state facts present on the fetched page. Otherwise set `placeholder: true`.
8. Run `npm run validate`, `lint`, `build`, and the smoke test, and look at the screenshots.

## News source

EnerKnol, "Carbon Pricing September 2026 Update" (2026-09-21), https://enerknol.com/carbon-pricing-september-2026-update/. Fetched with WebFetch; the page states the RGGI record price, proceeds above $1 billion, California-Quebec clearing 13% higher, and Washington down 39%.
