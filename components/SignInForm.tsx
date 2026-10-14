"use client";

import { useActionState } from "react";
import { sendMagicLink, type SignInState } from "@/lib/auth-actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendMagicLink, null);
  if (state?.sent) {
    return (
      <p className="mt-4 rounded-xl bg-muted px-3 py-3 text-sm" role="status">
        If that address can sign in, a link is on its way. Open it on this device.
      </p>
    );
  }
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm font-medium" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        maxLength={254}
        className="block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      {state?.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
