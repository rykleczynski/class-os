/**
 * Smoke test + screenshots. Needs `npm run dev` running on :3000.
 * Usage: npx tsx scripts/screenshots.ts
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = join(__dirname, "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const results: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

async function run(label: string, viewport: { width: number; height: number }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  const shot = (name: string, full = false) => page.screenshot({ path: join(OUT, `${label}-${name}.png`), fullPage: full });
  const next = async () => {
    await page.getByRole("button", { name: /Continue|Take the quiz/ }).click();
    await page.waitForTimeout(450);
  };

  // Dashboard
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot("dashboard", true);
  check(`${label} dashboard has 4 course cards`, (await page.getByTestId("course-card").count()) === 4);

  // Lesson player
  await page.goto(`${BASE}/lesson/econ106f-class3`, { waitUntil: "networkidle" });
  await shot("lesson-step1");
  // step 1 mcq feedback
  await page.getByRole("radio").nth(0).click();
  check(`${label} mcq shows feedback`, await page.getByTestId("mcq-feedback").isVisible());
  await shot("lesson-step1-answered");
  await next(); // step 2
  await next(); // step 3
  await next(); // step 4
  await next(); // step 5: slider
  const out = page.getByTestId("slider-output").first();
  const before = await out.innerText();
  await page.getByRole("slider", { name: "Discount rate" }).fill("3");
  await page.waitForTimeout(250);
  const after = await out.innerText();
  check(`${label} slider changes output`, before !== after, `${before} -> ${after}`);
  const dotBefore = await page.locator(".recharts-reference-dot circle").first().getAttribute("cy");
  await page.getByRole("slider", { name: "Discount rate" }).fill("12");
  await page.waitForTimeout(250);
  const dotAfter = await page.locator(".recharts-reference-dot circle").first().getAttribute("cy");
  check(`${label} slider moves plot marker`, dotBefore !== dotAfter, `cy ${dotBefore} -> ${dotAfter}`);
  await shot("lesson-step5-slider", true);
  await next(); // step 6
  await shot("lesson-step6", true);
  await next(); // quiz
  for (let q = 0; q < 5; q++) {
    await page.getByRole("radio").nth(1).click();
    await page.getByRole("button", { name: /Next question|See my score/ }).click();
    await page.waitForTimeout(150);
  }
  check(`${label} quiz shows a score`, /\d\/5/.test(await page.getByTestId("quiz-score").innerText()));
  await shot("lesson-quiz-results", true);
  await page.getByRole("button", { name: "On to flashcards" }).click();
  await page.waitForTimeout(450);
  await shot("lesson-flashcards");

  // Comm 187 scenario
  await page.goto(`${BASE}/lesson/comm187-class3`, { waitUntil: "networkidle" });
  await next();
  await next();
  await page.getByTestId("scenario").getByRole("button").nth(1).click();
  check(`${label} scenario shows outcome`, await page.getByTestId("scenario-outcome").isVisible());
  await shot("comm187-scenario", true);

  // Gallery
  await page.goto(`${BASE}/dev/blocks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const fallbacks = await page.getByTestId("block-fallback").count();
  check(`${label} gallery shows 2 fallback cards`, fallbacks === 2, `found ${fallbacks}`);
  const sd = await page.locator("svg[aria-label='A $20 tax shifts supply up']").count();
  check(`${label} gallery renders supplyDemand svg`, sd === 1);
  await shot("dev-blocks", true);

  // Course page
  await page.goto(`${BASE}/course/econ-106f`, { waitUntil: "networkidle" });
  await shot("course-econ106f", true);

  const realErrors = errors.filter((e) => !/Deliberate crash|The above error occurred|block ".*" crashed/.test(e));
  check(`${label} no unexpected console errors`, realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
  if (errors.length !== realErrors.length) results.push(`INFO ${label}: ${errors.length - realErrors.length} expected error(s) from the deliberate crash block`);
  await browser.close();
}

(async () => {
  await run("desktop", { width: 1280, height: 900 });
  await run("mobile", { width: 390, height: 844 });
  console.log(results.join("\n"));
  process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
})();
