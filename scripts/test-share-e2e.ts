/**
 * End-to-end share-link test with screenshots. Needs the app running in fixtures mode with the
 * throwaway in-memory share store:
 *
 *   CLASSOS_DEV_MEMORY_SHARING=1 npx next dev -p 3100
 *   BASE_URL=http://localhost:3100 npm run test:share:e2e
 *
 * The owner is the dev bypass here (no Supabase env), the guest is a separate browser context.
 * Writes docs/screenshots/share/*.png. Auth against a real Supabase project is not covered
 * (see the PR's manual checks).
 */
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { manifest } from "../lib/fixtures/manifest";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = join(__dirname, "..", "docs", "screenshots", "share");
mkdirSync(OUT, { recursive: true });

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

async function createLink(page: Page, label: string, expiry: string) {
  await page.getByTestId("share-button").click();
  await page.getByLabel("Who is it for?").fill(label);
  await page.getByLabel("Expires").selectOption(expiry);
  await page.getByRole("button", { name: "Create link" }).click();
  await page.getByTestId("share-url").waitFor();
  return page.getByTestId("share-url").inputValue();
}

/** Step through a lesson, answering the first multiple-choice option on each screen. Returns how many were answered. */
async function play(page: Page): Promise<number> {
  let answered = 0;
  for (let i = 0; i < 8; i++) {
    const opt = page.locator('[data-testid="mcq"] [role="radio"]').first();
    if (await opt.count()) {
      await opt.click({ timeout: 1000 }).then(() => answered++).catch(() => {});
    }
    const next = page.getByRole("button", { name: /Continue|Take the quiz/ });
    if (await next.isEnabled().catch(() => false)) await next.click();
    else break;
    await page.waitForTimeout(250);
  }
  return answered;
}

async function run(label: "desktop" | "mobile", viewport: { width: number; height: number }) {
  const browser = await chromium.launch();
  const owner = await browser.newContext({ viewport });
  const guest = await browser.newContext({ viewport });
  const op = await owner.newPage();
  const gp = await guest.newPage();
  const serverActionCalls: string[] = [];
  gp.on("request", (r) => {
    if (r.headers()["next-action"]) serverActionCalls.push(r.url());
  });
  const errors: string[] = [];
  gp.on("pageerror", (e) => errors.push(e.message));
  const tag = `[${label}]`;
  const who = label === "desktop" ? "Riley" : "Sam"; // the dev store is fresh per server start; restart the server between runs

  // --- owner: create a link
  await op.goto(`${BASE}/course/econ-106f`);
  await op.getByTestId("share-button").waitFor();
  const url = await createLink(op, who, "30d");
  const token = url.split("/s/")[1];
  check(`${tag} share url has a 43-char token`, /^[A-Za-z0-9_-]{43}$/.test(token ?? ""), url.replace(token ?? "", "<token>"));
  await op.screenshot({ path: join(OUT, `${label}-share-panel.png`) });
  await op.keyboard.press("Escape");
  await op.getByTestId("share-button").click();
  check(`${tag} full url is not shown again after the panel is reopened`, (await op.getByTestId("share-created").count()) === 0);
  check(`${tag} link listed with label, 0 uses`, (await op.getByTestId("share-links").locator("li", { hasText: who }).innerText()).includes("0 uses"));
  await op.keyboard.press("Escape");

  // --- owner: ECON 134 cannot be shared
  await op.goto(`${BASE}/course/econ-134`);
  await op.getByTestId("share-blocked").waitFor();
  check(`${tag} ECON 134 shows the reason, no Share button`, (await op.getByTestId("share-button").count()) === 0 && /syllabus prohibits sharing/.test(await op.getByTestId("share-blocked").innerText()));

  // --- guest: course view
  const res = await gp.goto(url);
  check(`${tag} guest landing 200`, res?.status() === 200);
  const h = res?.headers() ?? {};
  check(`${tag} noindex + no-referrer headers`, /noindex/.test(h["x-robots-tag"] ?? "") && h["referrer-policy"] === "no-referrer", `${h["x-robots-tag"]} / ${h["referrer-policy"]}`);
  check(`${tag} meta robots noindex`, (await gp.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex") ?? false);
  await gp.getByTestId("lesson-list").waitFor();
  const html = (await gp.content()).toLowerCase();
  const text = await gp.locator("body").innerText();
  check(`${tag} guest sees the course title`, /Finance/.test(text) && /ECON 106F/.test(text));
  check(`${tag} no Recordings/transcript section`, !/recordings|transcript/i.test(text));
  check(`${tag} no wispr anywhere in the HTML`, !html.includes("wispr"));
  check(`${tag} no other course data`, !/COMM 187|ECON 134|ECON 106FB|Media Ethics|Environmental/.test(text));
  check(`${tag} no links to /course, /courses or the dashboard`, (await gp.locator('a[href^="/course"], a[href="/"], a[href^="/lesson/"]').count()) === 0);
  check(`${tag} no sidebar nav`, (await gp.locator('nav[aria-label="Main"]').count()) === 0);
  const rows = await gp.getByTestId("lesson-row").count();
  check(`${tag} lists only 106F lessons`, rows > 0, `${rows} rows`);
  const ids = await gp.getByTestId("lesson-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-lesson-id")));
  const own = new Set(manifest.filter((m) => m.courseCode === "ECON 106F").map((m) => m.slug));
  check(`${tag} every listed lesson belongs to the course`, ids.every((i) => i && own.has(i)));
  await gp.screenshot({ path: join(OUT, `${label}-guest-course.png`), fullPage: true });

  // --- guest: lesson player, progress namespace, no server actions
  await gp.getByTestId("lesson-row").first().getByRole("link").click();
  await gp.waitForURL(/\/s\/[^/]+\/lesson\//);
  await gp.getByRole("heading", { level: 1 }).first().waitFor();
  await gp.waitForTimeout(500);
  await gp.screenshot({ path: join(OUT, `${label}-guest-lesson.png`) });
  const lessonText = await gp.locator("body").innerText();
  check(`${tag} lesson page has no wispr/transcript`, !(await gp.content()).toLowerCase().includes("wispr") && !/transcript/i.test(lessonText));
  const answered = await play(gp);
  await gp.waitForTimeout(300);
  const keys = await gp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("classos:")));
  check(`${tag} progress saved under classos:guest:econ-106f only`, keys.includes("classos:guest:econ-106f") && !keys.includes("classos:progress:v1"), keys.join(","));
  check(`${tag} guest answered ${answered} check(s) and triggered zero server actions (no attempts writes)`, answered > 0 && serverActionCalls.length === 0, `${serverActionCalls.length} calls`);
  // Positive control: the same interaction as the owner does call the attempts action.
  const ownerCalls: string[] = [];
  op.on("request", (r) => {
    if (r.headers()["next-action"]) ownerCalls.push(r.url());
  });
  await op.goto(`${BASE}/lesson/${ids[0]}`);
  await op.getByRole("heading", { level: 1 }).first().waitFor();
  const ownerAnswered = await play(op);
  await op.waitForTimeout(500);
  check(`${tag} control: owner answered ${ownerAnswered} and the attempts action fired`, ownerAnswered > 0 && ownerCalls.length > 0, `${ownerCalls.length} calls`);
  check(`${tag} no page errors for the guest`, errors.length === 0, errors.join("; "));

  // --- guest: lesson of another course is a 404
  const other = manifest.find((m) => m.courseCode !== "ECON 106F");
  if (other) {
    const r = await gp.goto(`${BASE}/s/${token}/lesson/${other.slug}`);
    check(`${tag} other course's lesson via this token is 404`, r?.status() === 404, `${r?.status()}`);
  }

  // --- guest: bad tokens
  for (const bad of ["abc", "A".repeat(43), "%2e%2e%2f%2e%2e%2fcourse%2fecon-106f"]) {
    const r = await gp.goto(`${BASE}/s/${bad}`);
    const body = await gp.locator("body").innerText();
    check(`${tag} bad token ${bad.slice(0, 12)} is a friendly 404`, r?.status() === 404 && /not available/i.test(body));
  }
  await gp.screenshot({ path: join(OUT, `${label}-guest-invalid.png`) });

  // --- owner sees uses, then revokes
  await op.goto(`${BASE}/course/econ-106f`);
  await op.getByTestId("share-button").click();
  const row = op.getByTestId("share-links").locator("li", { hasText: who });
  const list = await row.innerText();
  check(`${tag} owner sees 1 use and a last-used date`, /1 use\b/.test(list) && /last used/.test(list), list.replace(/\n/g, " "));
  await row.getByRole("button", { name: "Revoke" }).click();
  await row.and(op.locator('[data-status="revoked"]')).waitFor();
  const r2 = await gp.goto(url);
  check(`${tag} revoked link is a 404`, r2?.status() === 404);

  // --- expired link is a 404 (not exercised in the UI: the shortest expiry is 7 days; the unit tests cover it)
  await browser.close();
}

async function main() {
  await run("desktop", { width: 1280, height: 900 });
  await run("mobile", { width: 390, height: 844 });
  console.log(failed ? `\n${failed} FAILED` : "\nall share e2e checks passed");
  process.exit(failed ? 1 : 0);
}
void main();
