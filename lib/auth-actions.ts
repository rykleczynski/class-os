"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isOwnerEmail, normalizeEmail } from "./owner";
import { getAuthClient } from "./supabase/server";

export type SignInState = { sent?: boolean; error?: string } | null;

/**
 * Sends a magic link, but only when the address is the owner's. Everyone else gets the same
 * reply, so the form does not reveal which address is the owner and no other account is ever created.
 */
export async function sendMagicLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email || email.length > 254) return { error: "Enter your email address." };
  const auth = await getAuthClient();
  if (!auth) return { error: "Sign-in needs Supabase, which is not configured here." };
  if (isOwnerEmail(email)) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    const { error } = await auth.auth.signInWithOtp({
      email,
      options: { // The owner-email check above is the gate, so the first sign-in may create the account.
      shouldCreateUser: true, emailRedirectTo: `${proto}://${host}/auth/callback` },
    });
    if (error) {
      console.error(`signInWithOtp: ${error.message}`);
      return { error: "Could not send the link. Try again in a minute." };
    }
  }
  return { sent: true };
}

export async function signOut() {
  const auth = await getAuthClient();
  await auth?.auth.signOut();
  redirect("/sign-in");
}
