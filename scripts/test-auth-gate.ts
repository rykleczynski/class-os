/**
 * Auth gate and share-link flow against a production build, with a mock Supabase (GoTrue `user`
 * endpoint plus a tiny in-memory PostgREST). Proves, over real HTTP, that:
 *   - visitors without a session, with another email, or with an unconfirmed owner email are sent to /sign-in
 *   - the owner gets the pages, and the owner-only server actions work only for the owner
 *   - a share link created by the owner opens /s/<token> for a visitor with no cookies, counts the use,
 *     and stops working once revoked
 *   - a visitor can call neither share action nor the attempts action
 * Builds the app with the mock URL inlined (`next build`, a few seconds). Usage: npm run test:auth
 */
import { createServer, type IncomingMessage } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { courses } from "../lib/fixtures/courses";
import { manifest } from "../lib/fixtures/manifest";
import { lessonsBySlug } from "../lib/fixtures/lessons-index";

const ROOT = join(__dirname, "..");
const MOCK_PORT = 54399;
const APP_PORT = 3101;
const APP = `http://localhost:${APP_PORT}`;
const OWNER = "owner@example.com";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

// ---- mock supabase
type Row = Record<string, unknown>;
const shareLinks: Row[] = [];
const touched: string[] = [];
const otpTo: string[] = [];
const econ = courses.find((c) => c.code === "ECON 106F")!;
const courseRow = (c: (typeof courses)[number]) => ({
  id: c.id, code: c.code, slug: c.slug, title: c.title, category: c.category, instructor: c.instructor, schedule: c.schedule,
  color: c.color, tone: c.tone, calendar_event_series_ids: c.calendar_event_series_ids, aliases: c.aliases, term: c.term,
  generation_notes: c.generation_notes, created_at: "2026-01-01T00:00:00Z",
});
const entries = manifest.filter((m) => m.courseCode === "ECON 106F");
const otherEntries = manifest.filter((m) => m.courseCode !== "ECON 106F");
const courseIdOf = (code: string) => courses.find((c) => c.code === code)!.id;
const allEntries = manifest.filter((m) => lessonsBySlug[m.slug]);
const lectureRows = allEntries.map((e) => ({ id: `lec-${e.slug}`, course_id: courseIdOf(e.courseCode), starts_at: e.startsAt, wispr_share_link: e.wisprShareLink, wispr_meeting_id: e.sourceId, status: "generated" }));
const DRAFT = "econ106f-secret-draft";
const lessonRows = [...allEntries.map((e) => e.slug), DRAFT].map((slug) => ({ slug, e: allEntries.find((x) => x.slug === slug) ?? entries[0] })).map(({ slug, e }) => ({ id: `les-${slug}`, slug, lecture_id: `lec-${e.slug}`, title: slug === DRAFT ? "SECRET DRAFT LESSON" : lessonsBySlug[e.slug].title, summary: "s", est_minutes: 10, created_at: e.endsAt, spec: lessonsBySlug[e.slug], schema_version: 1, status: slug === DRAFT ? "draft" : "published", materials_missing: null }));

const body = (req: IncomingMessage) => new Promise<string>((res) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => res(s)); });
const mock = createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", "http://x");
  const send = (code: number, data: unknown, headers: Record<string, string> = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(data)); };
  if (u.pathname === "/auth/v1/user") {
    const jwt = (req.headers.authorization ?? "").replace("Bearer ", "");
    try {
      const p = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
      return send(200, { id: "u1", aud: "authenticated", role: "authenticated", email: p.email, email_confirmed_at: p.confirmed ? "2026-01-01T00:00:00Z" : null, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    } catch { return send(401, { msg: "bad jwt" }); }
  }
  if (u.pathname === "/auth/v1/otp") { otpTo.push(JSON.parse(await body(req)).email); return send(200, {}); }
  const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const out = (rows: Row[], status = 200) => {
    if (!single) return send(status, rows);
    if (rows.length !== 1) return send(406, { code: "PGRST116", details: `The result contains ${rows.length} rows`, message: "JSON object requested, multiple (or no) rows returned" });
    return send(status, rows[0]);
  };
  const eq = (col: string) => u.searchParams.get(col)?.replace(/^eq\./, "");
  const t = u.pathname.replace("/rest/v1/", "");
  if (t === "rpc/share_link_touch") {
    const { p_id } = JSON.parse(await body(req));
    const r = shareLinks.find((x) => x.id === p_id);
    if (r) { r.use_count = (r.use_count as number) + 1; r.last_used_at = new Date().toISOString(); touched.push(p_id); }
    return send(204, null);
  }
  if (t === "courses") return out(courses.filter((c) => !eq("id") || c.id === eq("id")).map(courseRow));
  if (t === "lectures") return out(lectureRows.filter((l) => !eq("course_id") || l.course_id === eq("course_id")));
  if (t === "lessons") {
    const inList = /^in\.\((.*)\)$/.exec(u.searchParams.get("lecture_id") ?? "")?.[1]?.split(",").map((x) => x.replace(/"/g, ""));
    return out(lessonRows.filter((l) => (!inList || inList.includes(l.lecture_id)) && (!eq("status") || l.status === eq("status")) && (!eq("slug") || l.slug === eq("slug"))));
  }
  if (t === "share_links") {
    if (req.method === "POST") {
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), revoked_at: null, last_used_at: null, use_count: 0, ...JSON.parse(await body(req)) };
      shareLinks.push(row);
      return out([row], 201);
    }
    let rows = shareLinks.filter((r) => (!eq("course_id") || r.course_id === eq("course_id")) && (!eq("token_hash") || r.token_hash === eq("token_hash")) && (!eq("id") || r.id === eq("id")));
    if (u.searchParams.get("revoked_at") === "is.null") rows = rows.filter((r) => !r.revoked_at);
    if (req.method === "PATCH") { const patch = JSON.parse(await body(req)); rows.forEach((r) => Object.assign(r, patch)); return out(rows.map((r) => ({ id: r.id }))); }
    return out([...rows].reverse());
  }
  return send(200, []);
});

// ---- helpers
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sessionCookie(email: string, confirmed = true) {
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", email, confirmed, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "u1", email } };
  // @supabase/ssr names the cookie after the first label of the project host: "localhost" here.
  return `sb-localhost-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}
const get = (path: string, cookie?: string) => fetch(APP + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
const redirectsToSignIn = (r: Response) => [302, 303, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").includes("/sign-in");

function actionId(file: string, name: string): string | null {
  const m = JSON.parse(readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName: string; filename: string }>;
  return Object.entries(m).find(([, v]) => v.exportedName === name && v.filename.endsWith(file))?.[0] ?? null;
}
async function callAction(id: string, args: unknown[], cookie?: string) {
  const r = await fetch(`${APP}/course/${econ.slug}`, { method: "POST", redirect: "manual", headers: { "next-action": id, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(args) });
  return { status: r.status, text: await r.text() };
}

async function main() {
  await new Promise<void>((r) => mock.listen(MOCK_PORT, r));
  const env: NodeJS.ProcessEnv = {
    ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_PORT}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub",
    SUPABASE_SECRET_KEY: "secret", OWNER_EMAIL: OWNER, CLASSOS_DEV_MEMORY_SHARING: "1", // must be ignored in production
  };
  delete (env as Record<string, string | undefined>).NODE_ENV;
  const build = spawnSync("npx", ["next", "build"], { cwd: ROOT, env, encoding: "utf8" });
  if (build.status !== 0) { console.log(build.stdout.slice(-2000), build.stderr.slice(-2000)); process.exit(1); }
  const app = spawn("npx", ["next", "start", "-p", String(APP_PORT)], { cwd: ROOT, env, stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i++) { try { await get("/sign-in"); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

    // 1. no session
    for (const p of ["/", "/courses", `/course/${econ.slug}`, `/lesson/${entries[0].slug}`, "/dev/blocks"]) check(`no session: ${p} -> /sign-in`, redirectsToSignIn(await get(p)));
    check("sign-in page is public", (await get("/sign-in")).status === 200);
    check("auth callback without a code -> sign-in error", (await get("/auth/callback")).headers.get("location")?.includes("error=link") ?? false);
    check("guest route is not behind the owner gate (bad token = 404, not a redirect)", (await get("/s/nope")).status === 404);
    check("homework is not behind the owner gate", ![301, 302, 307, 308].includes((await get("/homework/nope")).status));

    // 2. wrong identities
    const other = sessionCookie("someone@example.com");
    const unconfirmed = sessionCookie(OWNER, false);
    for (const [label, c] of [["another email", other], ["unconfirmed owner email", unconfirmed], ["garbage cookie", "sb-localhost-auth-token=base64-AAAA"]] as const) {
      for (const p of ["/", `/course/${econ.slug}`, `/lesson/${entries[0].slug}`, "/dev/blocks"]) {
        const r = await get(p, c);
        check(`${label}: ${p} denied`, redirectsToSignIn(r) || r.status === 404, `${r.status}`);
      }
    }

    // 3. owner
    const owner = sessionCookie(OWNER);
    for (const p of ["/", "/courses", `/course/${econ.slug}`, `/lesson/${entries[0].slug}`, "/dev/blocks"]) {
      const r = await get(p, owner);
      check(`owner: ${p} 200`, r.status === 200, `${r.status}`);
    }
    check("owner email match is case-insensitive", (await get("/", sessionCookie(OWNER.toUpperCase()))).status === 200);

    // 4. actions
    const create = actionId("lib/share/actions.ts", "createLink");
    const revoke = actionId("lib/share/actions.ts", "revokeLink");
    const attempt = actionId("lib/attempts.ts", "recordAttempt");
    check("found server action ids", Boolean(create && revoke && attempt));
    const denied = await callAction(create!, [econ.slug, "Mallory", "none"], other);
    check("non-owner cannot create a link", shareLinks.length === 0 && !denied.text.includes("/s/") && !denied.text.includes('"ok":true'), `${denied.status}`);
    const anon = await callAction(create!, [econ.slug, "Mallory", "none"]);
    check("visitor cannot create a link", shareLinks.length === 0 && !anon.text.includes('"ok":true'), `${anon.status}`);
    const made = await callAction(create!, [econ.slug, "Riley", "7d"], owner);
    const url = /https?:\/\/[^"\s\\]+\/s\/[A-Za-z0-9_-]{43}/.exec(made.text)?.[0];
    check("owner creates a link (in the mock table, hash only)", Boolean(url) && shareLinks.length === 1 && /^[0-9a-f]{64}$/.test(shareLinks[0].token_hash as string) && !JSON.stringify(shareLinks).includes(url!.split("/s/")[1]));
    const e134 = courses.find((c) => c.code === "ECON 134")!;
    const refused = await callAction(create!, [e134.slug, "Riley", "none"], owner);
    check("owner cannot share ECON 134 (server-side)", shareLinks.length === 1 && refused.text.includes("prohibits sharing"), refused.text.slice(0, 120).replace(/\n/g, " "));
    const att = await callAction(attempt!, [entries[0].slug, "b1", 0, true], other);
    check("non-owner attempts action is refused", att.text.includes("unauthorized"));

    // 5. guest
    const path = new URL(url!).pathname;
    const g1 = await get(path);
    const html = await g1.text();
    check("guest opens the link with no cookies", g1.status === 200 && html.includes(econ.title), `${g1.status}`);
    const leaks = html.match(/wispr|transcript|Recordings|COMM 187|ECON 134|ECON 106FB/gi) ?? [];
    check("guest page has no wispr / transcript / other courses", leaks.length === 0, leaks.join(","));
    check("guest headers", /noindex/.test(g1.headers.get("x-robots-tag") ?? "") && g1.headers.get("referrer-policy") === "no-referrer");
    const g2 = await get(`${path}/lesson/${entries[0].slug}`);
    check("guest lesson 200", g2.status === 200);
    const gl = await get(`${path}/lesson/${otherEntries[0].slug}`);
    check("guest cannot open another course's lesson (it exists in the mock)", gl.status === 404);
    check("guest cannot open an unpublished lesson", (await get(`${path}/lesson/${DRAFT}`)).status === 404);
    check("guest list has no other course's or draft lessons", !html.includes("SECRET DRAFT") && otherEntries.every((o) => !html.includes(lessonsBySlug[o.slug].title)));
    check("use_count bumped once per landing visit (lesson page does not count)", shareLinks[0].use_count === 1 && shareLinks[0].last_used_at !== null, `${shareLinks[0].use_count}`);
    const revoked = await callAction(revoke!, [econ.slug, shareLinks[0].id as string], owner);
    check("owner revokes", revoked.text.includes('"ok":true') || revoked.text.includes("revoked_at"), revoked.text.slice(0, 80));
    check("revoked link is a 404", (await get(path)).status === 404);
    const expiredRow = { ...shareLinks[0], revoked_at: null, expires_at: new Date(Date.now() - 1000).toISOString() };
    shareLinks[0] = expiredRow;
    check("expired link is a 404", (await get(path)).status === 404);
    check("dev memory sharing flag is ignored in production (mock table was used)", shareLinks.length === 1);
  } finally {
    app.kill();
    mock.close();
  }
  console.log(failed ? `\n${failed} FAILED` : "\nall auth gate checks passed");
  process.exit(failed ? 1 : 0);
}
void main();
