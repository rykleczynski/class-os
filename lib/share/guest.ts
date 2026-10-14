import "server-only";
import { headers } from "next/headers";
import { guest_findCourse } from "../data";
import type { Course } from "../fixtures/courses";
import { getShareStore } from "./index";
import { createFailureLimiter, validateToken, type ShareGrant } from "./service";

const limiter = createFailureLimiter();

async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * The one door for guest routes. Returns the grant and course, or null for anything wrong
 * (bad, unknown, revoked, expired or unshareable), with nothing about why. `touch` counts
 * the visit; only the course landing page sets it.
 */
export async function openShare(token: string, opts: { touch?: boolean } = {}): Promise<{ grant: ShareGrant; course: Course } | null> {
  const store = getShareStore();
  if (!store) return null;
  const key = await clientKey();
  if (limiter.blocked(key)) return null;
  let course: Course | undefined;
  const grant = await validateToken(store, token, {
    touch: opts.touch,
    courseOf: async (id) => {
      course = await guest_findCourse(id);
      return course;
    },
  });
  if (!grant || !course) {
    limiter.fail(key);
    return null;
  }
  return { grant, course };
}
