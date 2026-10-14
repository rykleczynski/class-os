import "server-only";
import { getCourse } from "../data";
import { getShareStore } from "./index";
import { shareDecision } from "./policy";
import { toSummary, type ShareLinkSummary } from "./store";

export type SharePanelState =
  | { status: "enabled"; links: ShareLinkSummary[] }
  | { status: "blocked"; reason: string }
  | { status: "unavailable"; reason: string };

/** Owner-only (getCourse checks): what the Share panel on /course/[code] shows for a course. */
export async function getSharePanelState(courseSlug: string): Promise<SharePanelState> {
  const course = await getCourse(courseSlug);
  if (!course) return { status: "unavailable", reason: "Unknown course." };
  const decision = shareDecision(course);
  if (!decision.ok) return { status: "blocked", reason: decision.reason };
  const store = getShareStore();
  if (!store) return { status: "unavailable", reason: "Sharing needs Supabase. It is off in local fixtures mode." };
  return { status: "enabled", links: (await store.listForCourse(course.id)).map(toSummary) };
}
