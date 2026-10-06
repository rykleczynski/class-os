import type { CSSProperties } from "react";

/**
 * Course identity colors live in globals.css as --course-1..4 (with light and dark
 * values), not in course data, so a course's accent follows the theme. Known
 * courses get a fixed slot; any new course gets a stable slot from its slug.
 */
const SLOTS: Record<string, number> = {
  "econ-106f": 1, // dusty blue
  "comm-187": 2, // terracotta
  "econ-134": 3, // olive
  "econ-106fb": 4, // plum
};

export function courseSlot(slug: string): number {
  if (SLOTS[slug]) return SLOTS[slug];
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 4) + 1;
}

/** Sets --course and --course-soft on an element so children can use bg-(--course) etc. */
export function courseStyle(slug: string): CSSProperties {
  const n = courseSlot(slug);
  return { "--course": `var(--course-${n})`, "--course-soft": `var(--course-${n}-soft)` } as CSSProperties;
}
