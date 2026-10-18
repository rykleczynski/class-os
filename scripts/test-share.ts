/**
 * Share-link logic tests: token hashing and validation, ECON 134 refusal, owner rules.
 * No network, no Supabase: everything runs against the in-memory store.
 * Usage: npm run test:share
 */
import assert from "node:assert/strict";
import { devBypassAllowed, isOwnerEmail } from "../lib/owner";
import { courses } from "../lib/fixtures/courses";
import { expiryFor, TERM_END_EXPIRY } from "../lib/share/expiry";
import { createMemoryStore } from "../lib/share/memory-store";
import { shareDecision } from "../lib/share/policy";
import { createFailureLimiter, createShareLink, MAX_ACTIVE_LINKS_PER_COURSE, revokeShareLink, validateToken } from "../lib/share/service";
import { toSummary } from "../lib/share/store";
import { generateToken, hashesEqual, hashToken, TOKEN_PATTERN } from "../lib/share/token";

const econ106 = courses.find((c) => c.code === "ECON 106F")!;
const comm = courses.find((c) => c.code === "COMM 187")!;
const econ134 = courses.find((c) => c.code === "ECON 134")!;
const courseOf = (id: string) => courses.find((c) => c.id === id);
const NOW = new Date("2026-10-14T12:00:00Z");

let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n  ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  await test("tokens are 43-char base64url and unique", () => {
    const a = generateToken();
    assert.match(a, TOKEN_PATTERN);
    assert.notEqual(a, generateToken());
  });

  await test("hash is sha256 hex, deterministic, and not the token", () => {
    const t = generateToken();
    assert.match(hashToken(t), /^[0-9a-f]{64}$/);
    assert.equal(hashToken(t), hashToken(t));
    assert.notEqual(hashToken(t), t);
    assert.ok(hashesEqual(hashToken(t), hashToken(t)));
    assert.ok(!hashesEqual(hashToken(t), hashToken(generateToken())));
    assert.ok(!hashesEqual("ab", "abc"));
  });

  await test("create stores only the hash; the summary has no hash", async () => {
    const store = createMemoryStore();
    const res = await createShareLink(store, { course: econ106, label: " Riley ", expiry: "none" }, NOW);
    assert.ok(res.ok);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].token_hash, hashToken(res.token));
    assert.equal(store.rows[0].label, "Riley");
    assert.ok(!JSON.stringify(store.rows).includes(res.token));
    assert.ok(!("token_hash" in res.link));
    assert.ok(!("token_hash" in toSummary(store.rows[0])));
  });

  await test("valid token validates and touch bumps use_count and last_used_at", async () => {
    const store = createMemoryStore();
    const res = await createShareLink(store, { course: econ106, label: "Riley", expiry: "7d" }, NOW);
    assert.ok(res.ok);
    const g = await validateToken(store, res.token, { now: NOW, courseOf, touch: true });
    assert.ok(g);
    assert.equal(g.courseId, econ106.id);
    assert.equal(store.rows[0].use_count, 1);
    assert.equal(store.rows[0].last_used_at, NOW.toISOString());
    await validateToken(store, res.token, { now: NOW, courseOf }); // no touch
    assert.equal(store.rows[0].use_count, 1);
  });

  await test("unknown, malformed and wrong tokens fail", async () => {
    const store = createMemoryStore();
    await createShareLink(store, { course: econ106, label: "Riley", expiry: "none" }, NOW);
    for (const t of [generateToken(), "short", "", "a".repeat(43) + "!", "../../etc/passwd", "a".repeat(500)]) {
      assert.equal(await validateToken(store, t, { now: NOW, courseOf }), null, t);
    }
  });

  await test("revoked token fails", async () => {
    const store = createMemoryStore();
    const res = await createShareLink(store, { course: econ106, label: "Riley", expiry: "none" }, NOW);
    assert.ok(res.ok);
    assert.ok(await revokeShareLink(store, econ106.id, res.link.id, NOW));
    assert.equal(await validateToken(store, res.token, { now: NOW, courseOf }), null);
    assert.equal(await revokeShareLink(store, econ106.id, res.link.id, NOW), false); // already revoked
  });

  await test("revoke is scoped to the course", async () => {
    const store = createMemoryStore();
    const res = await createShareLink(store, { course: econ106, label: "Riley", expiry: "none" }, NOW);
    assert.ok(res.ok);
    assert.equal(await revokeShareLink(store, comm.id, res.link.id, NOW), false);
    assert.ok(await validateToken(store, res.token, { now: NOW, courseOf }));
    assert.equal(await revokeShareLink(store, econ106.id, 42, NOW), false);
  });

  await test("expired token fails, one just before expiry works", async () => {
    const store = createMemoryStore();
    const res = await createShareLink(store, { course: econ106, label: "Riley", expiry: "7d" }, NOW);
    assert.ok(res.ok);
    const exp = Date.parse(res.link.expires_at!);
    assert.equal(exp - NOW.getTime(), 7 * 86400_000);
    assert.ok(await validateToken(store, res.token, { now: new Date(exp - 1), courseOf }));
    assert.equal(await validateToken(store, res.token, { now: new Date(exp), courseOf }), null);
    assert.equal(await validateToken(store, res.token, { now: new Date(exp + 86400_000), courseOf }), null);
  });

  await test("a token for one course does not open another", async () => {
    const store = createMemoryStore();
    const res = await createShareLink(store, { course: econ106, label: "Riley", expiry: "none" }, NOW);
    assert.ok(res.ok);
    assert.ok(await validateToken(store, res.token, { now: NOW, courseOf, expectCourseId: econ106.id }));
    assert.equal(await validateToken(store, res.token, { now: NOW, courseOf, expectCourseId: comm.id }), null);
    // the grant carries only the link's own course
    const g = await validateToken(store, res.token, { now: NOW, courseOf });
    assert.equal(g?.courseId, econ106.id);
  });

  await test("ECON 134 is refused on create, whatever the client sends", async () => {
    const store = createMemoryStore();
    const res = await createShareLink(store, { course: econ134, label: "Riley", expiry: "none" }, NOW);
    assert.deepEqual(res, { ok: false, error: "ECON 134's syllabus prohibits sharing course content" });
    assert.equal(store.rows.length, 0);
    // a DB-shaped course (uuid id, same code) is refused too
    const dbShaped = { id: "0b7c2f1e-0000-0000-0000-000000000000", code: "ECON 134" };
    assert.equal((await createShareLink(store, { course: dbShaped, label: "x", expiry: "none" }, NOW)).ok, false);
    assert.equal(store.rows.length, 0);
  });

  await test("an ECON 134 link that already exists in the table does not open", async () => {
    const store = createMemoryStore();
    const token = generateToken();
    await store.insert({ course_id: econ134.id, token_hash: hashToken(token), label: "planted", expires_at: null });
    assert.equal(await validateToken(store, token, { now: NOW, courseOf }), null);
    assert.equal(store.rows[0].use_count, 0);
  });

  await test("courses the fixtures do not know are not shareable (fail closed)", () => {
    assert.equal(shareDecision({ id: "x", code: "MATH 1" }).ok, false);
    assert.equal(shareDecision(econ106).ok, true);
    assert.equal(shareDecision(econ134).ok, false);
  });

  await test("ECON 134 stays unshareable on shareable: false alone, now that its course files are allowed", () => {
    assert.notEqual(econ134.materials_allowed, false, "course files are allowed");
    assert.equal(econ134.shareable, false);
    const d = shareDecision(econ134);
    assert.ok(!d.ok && d.reason === econ134.share_blocked_reason);
  });

  await test("any course that opts out of materials is also blocked from sharing", () => {
    for (const c of courses.filter((x) => x.materials_allowed === false)) assert.equal(shareDecision(c).ok, false, c.code);
  });

  await test("label and expiry validation", async () => {
    const store = createMemoryStore();
    assert.equal((await createShareLink(store, { course: econ106, label: "   ", expiry: "none" }, NOW)).ok, false);
    assert.equal((await createShareLink(store, { course: econ106, label: 5, expiry: "none" }, NOW)).ok, false);
    assert.equal((await createShareLink(store, { course: econ106, label: "x".repeat(61), expiry: "none" }, NOW)).ok, false);
    assert.equal((await createShareLink(store, { course: econ106, label: "ok", expiry: "forever" }, NOW)).ok, false);
    assert.equal(store.rows.length, 0);
    assert.equal(expiryFor("none", NOW), null);
    assert.equal(expiryFor("30d", NOW), new Date(NOW.getTime() + 30 * 86400_000).toISOString());
    assert.equal(expiryFor("term", NOW), TERM_END_EXPIRY);
    assert.throws(() => expiryFor("term", new Date("2026-12-10T00:00:00Z")));
    assert.throws(() => expiryFor("bogus", NOW));
  });

  await test("active links per course are capped", async () => {
    const store = createMemoryStore();
    for (let i = 0; i < MAX_ACTIVE_LINKS_PER_COURSE; i++) assert.ok((await createShareLink(store, { course: comm, label: `g${i}`, expiry: "none" }, NOW)).ok);
    assert.equal((await createShareLink(store, { course: comm, label: "one more", expiry: "none" }, NOW)).ok, false);
    assert.ok((await createShareLink(store, { course: econ106, label: "other course", expiry: "none" }, NOW)).ok);
  });

  await test("failure limiter blocks after the limit and recovers", () => {
    const l = createFailureLimiter(3, 1000);
    for (let i = 0; i < 3; i++) {
      assert.equal(l.blocked("ip", 0), false);
      l.fail("ip", 0);
    }
    assert.equal(l.blocked("ip", 500), true);
    assert.equal(l.blocked("other", 500), false);
    assert.equal(l.blocked("ip", 1500), false);
  });

  await test("owner email: exact match only, case-insensitive, unset means nobody", () => {
    assert.ok(isOwnerEmail("rykleczynski@gmail.com", "rykleczynski@gmail.com"));
    assert.ok(isOwnerEmail("  RyKleczynski@Gmail.com ", "rykleczynski@gmail.com"));
    assert.ok(!isOwnerEmail("someone@gmail.com", "rykleczynski@gmail.com"));
    assert.ok(!isOwnerEmail("rykleczynski@gmail.com.evil.com", "rykleczynski@gmail.com"));
    assert.ok(!isOwnerEmail("x" + "rykleczynski@gmail.com", "rykleczynski@gmail.com"));
    assert.ok(!isOwnerEmail("rykleczynski@gmail.com", ""));
    assert.ok(!isOwnerEmail("", ""));
    assert.ok(!isOwnerEmail(undefined, "a@b.c"));
    assert.ok(!isOwnerEmail(["rykleczynski@gmail.com"], "rykleczynski@gmail.com"));
  });

  await test("dev bypass: only outside production and only without Supabase", () => {
    assert.equal(devBypassAllowed({ NODE_ENV: "development", supabaseEnabled: false }), true);
    assert.equal(devBypassAllowed({ NODE_ENV: "production", supabaseEnabled: false }), false);
    assert.equal(devBypassAllowed({ NODE_ENV: "development", supabaseEnabled: true }), false);
    assert.equal(devBypassAllowed({ NODE_ENV: "production", supabaseEnabled: true }), false);
  });

  console.log(failed ? `\n${failed} FAILED` : "\nall share tests passed");
  process.exit(failed ? 1 : 0);
}
void main();
