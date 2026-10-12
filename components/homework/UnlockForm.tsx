"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unlockHomework, type UnlockState } from "@/lib/homework-actions";

/** Passcode form. Shows nothing about the set, not even its title, until the passcode is accepted. */
export function UnlockForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockHomework.bind(null, slug), null);
  return (
    <form action={action} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold tracking-tight">Homework</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Enter the passcode to open this page.</p>
      <label htmlFor="hw-passcode" className="sr-only">
        Passcode
      </label>
      <input
        id="hw-passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        required
        maxLength={200}
        className="mt-4 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-invalid={state?.error ? true : undefined}
        aria-describedby={state?.error ? "hw-passcode-error" : undefined}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Checking…" : "Unlock"}
        </Button>
        <p id="hw-passcode-error" aria-live="polite" className="text-sm text-bad">
          {state?.error}
        </p>
      </div>
    </form>
  );
}
