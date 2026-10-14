import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/SignInForm";
import { isOwner } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase/client";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await isOwner()) redirect("/");
  const sp = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-semibold tracking-tight">Class OS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with a magic link. This site is private.</p>
        {sp.error && (
          <p role="alert" className="mt-4 rounded-xl border border-bad bg-bad-soft px-3 py-2 text-sm">
            That link did not work. Request a new one.
          </p>
        )}
        {supabaseEnabled ? (
          <SignInForm />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Sign-in is not configured on this deployment.</p>
        )}
      </div>
    </div>
  );
}
