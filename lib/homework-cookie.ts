import "server-only";
import { cookies } from "next/headers";

/**
 * Name, scope and read side of the per-set passcode cookie. Only lib/homework-actions.ts
 * sets or deletes it; the page only reads it. Kept out of the "use server" file so the read
 * is not itself a callable action that would hand an httpOnly value back to page JS.
 */
export const HOMEWORK_SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const homeworkCookieName = (slug: string) => `hw_${slug}`;
export const homeworkPath = (slug: string) => `/homework/${slug}`;

export async function readHomeworkPasscode(slug: string): Promise<string | null> {
  if (!HOMEWORK_SLUG.test(slug)) return null;
  return (await cookies()).get(homeworkCookieName(slug))?.value ?? null;
}
