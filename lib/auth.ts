import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { devBypassAllowed, isOwnerEmail } from "./owner";
import { getAuthClient } from "./supabase/server";
import { supabaseEnabled } from "./supabase/client";

/**
 * Owner check. The owner is whoever signs in with the single address in OWNER_EMAIL.
 * `getUser()` asks the Auth server to validate the JWT, so a forged cookie fails here.
 * Cached per request.
 */
export const isOwner = cache(async (): Promise<boolean> => {
  if (devBypassAllowed({ NODE_ENV: process.env.NODE_ENV, supabaseEnabled })) return true;
  // Per-request work: never let a page that depends on the owner be prerendered at build time.
  await connection();
  if (!supabaseEnabled) return false;
  const auth = await getAuthClient();
  if (!auth) return false;
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return false;
  // Magic links only prove control of the mailbox when the address is confirmed.
  if (!data.user.email_confirmed_at) return false;
  return isOwnerEmail(data.user.email);
});

/** For pages and data reads: sends everyone else to the sign-in page. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) redirect("/sign-in");
}

/** For server actions and route handlers: throw, never redirect. */
export async function assertOwner(): Promise<void> {
  if (!(await isOwner())) throw new Error("Not authorized");
}
