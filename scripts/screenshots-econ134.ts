/**
 * Smoke test + screenshots for the ECON 134 Oct 5 lesson. Needs the dev server (BASE_URL).
 * Usage: BASE_URL=http://localhost:3300 npx tsx scripts/screenshots-econ134.ts
 */
import { chromium } from "playwright";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = join(__dirname, "..", "docs", "screenshots");
const results: string[] = [];
const check = (n: string, ok: boolean, d = "") => results.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? ` (${d})` : ""}`);

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  // Screenshot the graph figure itself (the sticky footer would cover a full-page capture).
  const shot = async (n: string, label?: string) => {
    const el = label ? page.locator("figure").filter({ has: page.locator(`svg[aria-label='${label}']`) }) : null;
    await (el ? el.screenshot({ path: join(OUT, `econ134-${n}.png`) }) : page.screenshot({ path: join(OUT, `econ134-${n}.png`) }));
  };
  const next = async () => {
    await page.getByRole("button", { name: /Continue|Take the quiz/ }).click();
    await page.waitForTimeout(450);
  };

  await page.goto(`${BASE}/course/econ-134`, { waitUntil: "networkidle" });
  check("course page lists the lesson", (await page.getByText("Fixing externalities").count()) > 0);

  await page.goto(`${BASE}/lesson/econ134-2026-10-05`, { waitUntil: "networkidle" });
  check("step 1 supplyDemand svg", (await page.locator("svg[aria-label='The externality and the social optimum']").count()) === 1);
  check("step 1 DWL area label", (await page.getByText("DWL = 300").count()) > 0);
  await shot("step1-externality", "The externality and the social optimum");
  await next();
  check("step 2 tax graph", (await page.locator("svg[aria-label='A tax of $20 puts the firm at Q_FB']").count()) === 1);
  await shot("step2-pigou-tax", "A tax of $20 puts the firm at Q_FB");
  await next();
  const out = page.getByTestId("slider-output").first();
  const s = page.getByRole("slider", { name: /Tax per unit/ });
  await s.fill("30");
  await page.waitForTimeout(250);
  const at30 = await out.innerText();
  await s.fill("20");
  await page.waitForTimeout(250);
  const at20 = await out.innerText();
  await s.fill("0");
  await page.waitForTimeout(250);
  const at0 = await out.innerText();
  const num = (t: string) => Number(t.trim().replace(/[^0-9.-]/g, ""));
  check("slider DWL 75 at tau=30, 0 at tau=20, 300 at tau=0", num(at30) === 75 && num(at20) === 0 && num(at0) === 300, `${at30} | ${at20} | ${at0}`);
  await s.fill("30");
  await page.waitForTimeout(250);
  check("step 3 overtax graph", (await page.locator("svg[aria-label='Too high: τ = D′(Q_M) = 30']").count()) === 1);
  await shot("step3-overtax-dwl", "Too high: τ = D′(Q_M) = 30");
  await page.locator("figure").filter({ has: page.getByTestId("slider-output") }).first().screenshot({ path: join(OUT, "econ134-step3-slider.png") });
  await next();
  check("step 4 revenue graph", (await page.locator("svg[aria-label='Revenue R = 20 x 40 = 800']").count()) === 1);
  await shot("step4-revenue", "Revenue R = 20 x 40 = 800");
  await next();
  await page.getByTestId("scenario").getByRole("button").nth(1).click();
  check("step 5 scenario outcome", await page.getByTestId("scenario-outcome").isVisible());
  await shot("step5-coase-gains", "Total surplus at the efficient output = 1200");
  await shot("step5-coase-scenario");
  await next();
  check("step 6 news block", (await page.getByText("EnerKnol").count()) > 0);
  await shot("step6-coase-fails");
  const real = errors.filter((e) => !/favicon/.test(e));
  check("no console errors", real.length === 0, real.slice(0, 3).join(" | "));
  await browser.close();
  console.log(results.join("\n"));
  process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
})();
