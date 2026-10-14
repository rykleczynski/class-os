"use server";

import { headers } from "next/headers";
import { assertOwner } from "../auth";
import { getCourse } from "../data";
import { getShareStore } from "./index";
import { createShareLink, revokeShareLink } from "./service";
import type { Course } from "../fixtures/courses";
import { toSummary, type ShareLinkSummary, type ShareStore } from "./store";

/**
 * Owner-only server actions behind the Share panel. Each is a public POST endpoint, so each
 * re-checks the owner, resolves the course itself and enforces the share policy; nothing is
 * trusted from the client except the course slug, label and expiry choice.
 */
export type CreateLinkResult =
  | { ok: true; url: string; links: ShareLinkSummary[] }
  | { ok: false; error: string };
export type RevokeLinkResult = { ok: true; links: ShareLinkSummary[] } | { ok: false; error: string };

type Resolved = { ok: true; course: Course; store: ShareStore } | { ok: false; error: string };

async function resolve(courseSlug: unknown): Promise<Resolved> {
  await assertOwner();
  if (typeof courseSlug !== "string" || courseSlug.length > 80) return { ok: false, error: "Unknown course." };
  const course = await getCourse(courseSlug);
  if (!course) return { ok: false, error: "Unknown course." };
  const store = getShareStore();
  if (!store) return { ok: false, error: "Sharing needs Supabase and is off here." };
  return { ok: true, course, store };
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function createLink(courseSlug: string, label: string, expiry: string): Promise<CreateLinkResult> {
  const r = await resolve(courseSlug);
  if (!r.ok) return { ok: false, error: r.error };
  // createShareLink applies shareDecision again, so an unshareable course is refused here even if the UI were bypassed.
  const res = await createShareLink(r.store, { course: r.course, label, expiry });
  if (!res.ok) return res;
  const links = (await r.store.listForCourse(r.course.id)).map(toSummary);
  return { ok: true, url: `${await origin()}/s/${res.token}`, links };
}

export async function revokeLink(courseSlug: string, linkId: string): Promise<RevokeLinkResult> {
  const r = await resolve(courseSlug);
  if (!r.ok) return { ok: false, error: r.error };
  if (!(await revokeShareLink(r.store, r.course.id, linkId))) return { ok: false, error: "That link was not found." };
  return { ok: true, links: (await r.store.listForCourse(r.course.id)).map(toSummary) };
}
