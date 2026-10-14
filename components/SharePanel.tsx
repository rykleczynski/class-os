"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Copy, Share2, X } from "lucide-react";
import { createLink, revokeLink } from "@/lib/share/actions";
import { EXPIRY_CHOICES, type ExpiryChoice } from "@/lib/share/expiry";
import type { ShareLinkSummary } from "@/lib/share/store";

type Props =
  | { courseSlug: string; courseCode: string; status: "enabled"; initialLinks: ShareLinkSummary[] }
  | { courseSlug: string; courseCode: string; status: "blocked" | "unavailable"; reason: string };

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
const day = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "");

function statusOf(l: ShareLinkSummary): "active" | "revoked" | "expired" {
  if (l.revoked_at) return "revoked";
  if (l.expires_at && Date.parse(l.expires_at) <= Date.now()) return "expired";
  return "active";
}

export function SharePanel(props: Props) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLinkSummary[]>(props.status === "enabled" ? props.initialLinks : []);
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState<ExpiryChoice>("none");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (props.status !== "enabled") {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end" data-testid="share-blocked">
        <button type="button" disabled className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold opacity-50">
          <Share2 className="h-4 w-4" aria-hidden /> Share
        </button>
        <p className="max-w-64 text-xs text-muted-foreground sm:text-right">{props.reason}</p>
      </div>
    );
  }

  const create = () =>
    start(async () => {
      setError(null);
      setCopied(false);
      const res = await createLink(props.courseSlug, label, expiry);
      if (!res.ok) return setError(res.error);
      setLinks(res.links);
      setCreated(res.url);
      setLabel("");
    });

  const revoke = (id: string) =>
    start(async () => {
      setError(null);
      const res = await revokeLink(props.courseSlug, id);
      if (!res.ok) return setError(res.error);
      setLinks(res.links);
    });

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the link and copy it by hand.");
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // The full URL is shown once. Closing the panel forgets it.
          setCreated(null);
          setCopied(false);
          setError(null);
        }
      }}
    >
      <Dialog.Trigger className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-control" data-testid="share-button">
        <Share2 className="h-4 w-4" aria-hidden /> Share
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup className="fixed inset-x-3 bottom-3 top-auto z-50 max-h-[85dvh] overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-soft sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2" data-testid="share-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight">Share {props.courseCode}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Anyone with the link sees this course&apos;s lessons only. No transcripts, no other courses.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <div>
              <label htmlFor="share-label" className="text-sm font-medium">
                Who is it for?
              </label>
              <input
                id="share-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                required
                placeholder="Riley"
                className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="share-expiry" className="text-sm font-medium">
                Expires
              </label>
              <select
                id="share-expiry"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value as ExpiryChoice)}
                className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {EXPIRY_CHOICES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={pending || !label.trim()} className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {pending ? "Working…" : "Create link"}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-3 text-sm text-bad">
              {error}
            </p>
          )}

          {created && (
            <div className="mt-4 rounded-2xl border border-border bg-muted/60 p-3" data-testid="share-created">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Copy it now. It is shown once.</p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly value={created} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-xs" data-testid="share-url" />
                <button type="button" onClick={copy} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <h3 className="mt-6 text-sm font-semibold">Links</h3>
          {links.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border" data-testid="share-links">
              {links.map((l) => {
                const st = statusOf(l);
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5" data-status={st}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {l.label}
                        {st !== "active" && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{st}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {day(l.created_at)}
                        {l.expires_at ? ` · expires ${day(l.expires_at)}` : ""} · {l.use_count} {l.use_count === 1 ? "use" : "uses"}
                        {l.last_used_at ? ` · last used ${day(l.last_used_at)}` : ""}
                      </p>
                    </div>
                    {st === "active" && (
                      <button type="button" onClick={() => revoke(l.id)} disabled={pending} className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold hover:border-bad hover:text-bad disabled:opacity-50">
                        Revoke
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
