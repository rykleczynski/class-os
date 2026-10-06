/**
 * Smoke test + screenshots. Needs the app running (fixtures mode expected).
 * BASE_URL defaults to http://localhost:3000. Override: BASE_URL=http://localhost:3100 npx tsx scripts/screenshots.ts
 * Expects 4 course cards on the dashboard and on /courses (ECON 106F, COMM 187, ECON 134, ECON 106FB).
 * Usage: npm run smoke
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

  // Courses index + sidebar links
  await page.goto(`${BASE}/courses`, { waitUntil: "networkidle" });
  await shot("courses", true);
  check(`${label} /courses lists 4 course cards`, (await page.getByTestId("course-card").count()) === 4);
  const sidebar = page.locator(`nav[aria-label="Main"]:visible`);
  check(`${label} Courses nav is active on /courses`, (await sidebar.locator('a[aria-current="page"]').getAttribute("aria-label").catch(() => null)) === "Courses" || (await sidebar.locator('a[aria-current="page"]').innerText()).includes("Courses"));
  check(`${label} no Block gallery in nav`, (await sidebar.getByText(/Block gallery|Blocks/).count()) === 0);
  for (const name of ["Courses", "Latest lesson", "Review"]) {
    const href = await sidebar.getByRole("link", { name }).first().getAttribute("href");
    const res = href ? await page.request.get(`${BASE}${href}`) : null;
    check(`${label} sidebar "${name}" resolves`, !!res && res.ok(), `${href} -> ${res?.status()}`);
  }
  check(`${label} Latest lesson is the newest lesson`, (await sidebar.getByRole("link", { name: "Latest lesson" }).first().getAttribute("href")) === "/lesson/econ134-2026-10-05");
  await page.goto(`${BASE}/course/econ-106f`, { waitUntil: "networkidle" });
  check(`${label} Courses nav stays active on /course/*`, (await sidebar.locator('a[aria-current="page"]').innerText()).includes("Courses") || (await sidebar.locator('a[aria-current="page"]').getAttribute("aria-label")) === "Courses");

  // Lesson picker: Start opens a sheet listing the course's lessons with progress
  const econCard = () => page.getByTestId("course-card").filter({ hasText: /ECON 106F(?!B)/ });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(`${label} card starts at 0 completed`, /^0\/\d+ lessons$/.test((await econCard().getByTestId("card-count").innerText()).trim()));
  await shot("card-before-start");
  await econCard().getByRole("button", { name: /Start|Continue/ }).click();
  const picker = page.getByTestId("lesson-picker");
  await picker.waitFor();
  await page.waitForTimeout(400);
  const rows = await picker.getByTestId("lesson-row").count();
  check(`${label} picker lists the course's lessons`, rows === 3, `${rows} rows`);
  check(`${label} picker shows Not started + Up next`, (await picker.getByText("Not started").count()) === 3 && (await picker.getByText("Up next").count()) === 1);
  check(`${label} picker has View course link`, (await picker.getByRole("link", { name: "View course" }).getAttribute("href")) === "/course/econ-106f");
  await shot("picker-not-started");
  await page.keyboard.press("Escape");
  check(`${label} Escape closes the picker`, await picker.waitFor({ state: "detached" }).then(() => true, () => false));
  await econCard().getByRole("button", { name: /Start/ }).click();
  await picker.getByRole("link", { name: /^Start Value, price/ }).click();
  await page.waitForURL(/\/lesson\/econ106f-class3$/);
  await next();
  await next();
  // Reload mid-lesson: the player must resume at step 3, with a Start over option.
  await page.reload({ waitUntil: "networkidle" });
  check(`${label} reload resumes at step 3`, (await page.locator('section[aria-labelledby="step-title"]').getByText(/Step 3 of \d+/).count()) === 1);
  check(`${label} resume banner offers Start over`, await page.getByTestId("resume-banner").getByRole("button", { name: "Start over" }).isVisible());
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await econCard().getByRole("button", { name: "Continue" }).click();
  await picker.waitFor();
  await page.waitForTimeout(400);
  check(`${label} picker shows Step 3 of N + Resume`, (await picker.getByText(/Step 3 of \d+/).count()) === 1 && (await picker.getByRole("link", { name: /^Resume / }).count()) === 1);
  await shot("picker-in-progress");
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/course/econ-106f`, { waitUntil: "networkidle" });
  check(`${label} course page shows the same progress`, (await page.getByTestId("lesson-list").getByText(/Step 3 of \d+/).count()) === 1);

  // Lesson player
  await page.goto(`${BASE}/lesson/econ106f-class3`, { waitUntil: "networkidle" });
  // Opening the lesson resumes at step 3; Start over returns to step 1.
  await page.getByTestId("resume-banner").getByRole("button", { name: "Start over" }).click();
  await page.waitForTimeout(600);
  check(`${label} Start over returns to step 1`, (await page.locator('section[aria-labelledby="step-title"]').getByText(/Step 1 of \d+/).count()) === 1);
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
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(`${label} card counts the finished lesson`, (await econCard().getByTestId("card-count").innerText()).trim().startsWith("1/"));
  await econCard().getByRole("button", { name: "Continue" }).click();
  await picker.waitFor();
  await page.waitForTimeout(400);
  check(`${label} picker shows Completed with quiz score + Review`, (await picker.getByText(/Completed · Quiz \d\/5/).count()) === 1 && (await picker.getByRole("link", { name: /^Review / }).count()) === 1);
  await shot("picker-completed");
  await page.keyboard.press("Escape");

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
