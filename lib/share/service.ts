import { shareDecision } from "./policy";
import { expiryFor } from "./expiry";
import { generateToken, hashesEqual, hashToken, TOKEN_PATTERN } from "./token";
import { toSummary, type ShareLinkSummary, type ShareStore } from "./store";

/**
 * Share-link rules, independent of Next and Supabase so the tests can run them against the
 * memory store. Server actions and guest routes are thin wrappers over these.
 */
export const MAX_LABEL = 60;
export const MAX_ACTIVE_LINKS_PER_COURSE = 25;

/** Proof that a token was validated. Guest data reads require one, so they cannot be called with a raw course id. */
export type ShareGrant = Readonly<{ linkId: string; courseId: string; label: string; readonly __grant: true }>;

export type CreateResult =
  | { ok: true; token: string; link: ShareLinkSummary }
  | { ok: false; error: string };

export async function createShareLink(
  store: ShareStore,
  input: { course: { id: string; code: string }; label: unknown; expiry: unknown },
  now: Date = new Date(),
): Promise<CreateResult> {
  const decision = shareDecision(input.course);
  if (!decision.ok) return { ok: false, error: decision.reason };
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (!label) return { ok: false, error: "Add a label so you can tell the links apart." };
  if (label.length > MAX_LABEL) return { ok: false, error: `Keep the label under ${MAX_LABEL} characters.` };
  let expiresAt: string | null;
  try {
    expiresAt = expiryFor(typeof input.expiry === "string" ? input.expiry : "none", now);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bad expiry" };
  }
  const active = (await store.listForCourse(input.course.id)).filter((l) => !l.revoked_at && (!l.expires_at || Date.parse(l.expires_at) > now.getTime()));
  if (active.length >= MAX_ACTIVE_LINKS_PER_COURSE) return { ok: false, error: "Too many active links. Revoke some first." };
  const token = generateToken();
  const row = await store.insert({ course_id: input.course.id, token_hash: hashToken(token), label, expires_at: expiresAt });
  return { ok: true, token, link: toSummary(row) };
}

/**
 * Validate a guest token. Returns null for every failure (malformed, unknown, revoked, expired, wrong
 * course, unshareable course) with no detail, so a guesser learns nothing. `expectCourseId`, when given,
 * must match the link's course.
 */
export async function validateToken(
  store: ShareStore,
  token: string,
  opts: { now?: Date; touch?: boolean; courseOf: (courseId: string) => Promise<{ id: string; code: string } | undefined> | { id: string; code: string } | undefined; expectCourseId?: string },
): Promise<ShareGrant | null> {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  const hash = hashToken(token);
  const row = await store.findByHash(hash);
  if (!row || !hashesEqual(row.token_hash, hash)) return null;
  const now = opts.now ?? new Date();
  if (row.revoked_at) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= now.getTime()) return null;
  if (opts.expectCourseId && row.course_id !== opts.expectCourseId) return null;
  const course = await opts.courseOf(row.course_id);
  if (!course || !shareDecision(course).ok) return null;
  if (opts.touch) await store.touch(row.id, now.toISOString());
  return { linkId: row.id, courseId: row.course_id, label: row.label, __grant: true };
}

export async function revokeShareLink(store: ShareStore, courseId: string, linkId: unknown, now: Date = new Date()): Promise<boolean> {
  if (typeof linkId !== "string" || linkId.length > 64) return false;
  return store.revoke(linkId, courseId, now.toISOString());
}

/** Tiny per-process limiter for failed token lookups. Best effort: tokens are 256-bit, this only blunts noise. */
export function createFailureLimiter(max = 30, windowMs = 60_000) {
  const hits = new Map<string, number[]>();
  return {
    blocked(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      hits.set(key, recent);
      return recent.length >= max;
    },
    fail(key: string, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    },
  };
}
