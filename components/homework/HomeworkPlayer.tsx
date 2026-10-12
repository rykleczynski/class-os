"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Copy, Lock } from "lucide-react";
import { Md } from "@/components/Md";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMounted } from "@/components/blocks/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { courseStyle } from "@/lib/course-theme";
import { lockHomework, saveAnswer } from "@/lib/homework-actions";
import type { HomeworkModule, HomeworkSpec, HomeworkStatus } from "@/lib/homework-spec";

type Props = {
  slug: string;
  title: string;
  dueAt: string | null;
  courseCode: string;
  courseSlug: string;
  spec: HomeworkSpec;
  answers: Array<{ module_id: string; answer: string; status: HomeworkStatus | null; updated_at: string }>;
};

type Entry = { answer: string; status: HomeworkStatus | null; updatedAt: number };
type Entries = Record<string, Entry>;
type Sync = "pending" | "saving" | "saved" | "retrying" | "failed";

const DEBOUNCE_MS = 800;
const RETRY_MS = 5000;

/**
 * Local mirror of Ryan's answers (never the problem text), so a save that fails is not lost.
 * Every storage access is guarded: without storage the server copy is all there is.
 */
const draftKey = (slug: string) => `classos:homework:${slug}`;

function readDrafts(slug: string): Entries {
  try {
    const raw = JSON.parse(localStorage.getItem(draftKey(slug)) ?? "{}") as Record<string, Partial<Entry>>;
    const out: Entries = {};
    for (const [id, e] of Object.entries(raw ?? {})) {
      if (typeof e?.answer !== "string" || typeof e.updatedAt !== "number") continue;
      out[id] = { answer: e.answer, status: e.status === "got" || e.status === "review" ? e.status : null, updatedAt: e.updatedAt };
    }
    return out;
  } catch {
    return {};
  }
}

function writeDrafts(slug: string, entries: Entries) {
  try {
    localStorage.setItem(draftKey(slug), JSON.stringify(entries));
  } catch {
    /* storage full or blocked: the server save still runs */
  }
}

function clearDrafts(slug: string) {
  try {
    localStorage.removeItem(draftKey(slug));
  } catch {
    /* storage blocked: nothing was written either */
  }
}

/** Server answers win unless this browser holds a newer, different draft; those are queued for saving. */
function initialEntries(slug: string, modules: HomeworkModule[], answers: Props["answers"]) {
  const server = new Map(answers.map((a) => [a.module_id, a]));
  const local = readDrafts(slug);
  const entries: Entries = {};
  const unsaved: string[] = [];
  for (const m of modules) {
    const s = server.get(m.id);
    const fromServer: Entry = s
      ? { answer: s.answer, status: s.status, updatedAt: Date.parse(s.updated_at) || 0 }
      : { answer: "", status: null, updatedAt: 0 };
    const l = local[m.id];
    if (l && l.updatedAt > fromServer.updatedAt && (l.answer !== fromServer.answer || l.status !== fromServer.status)) {
      entries[m.id] = l;
      unsaved.push(m.id);
    } else {
      entries[m.id] = fromServer;
    }
  }
  return { entries, unsaved };
}

function exportText(modules: HomeworkModule[], entries: Entries): string {
  return modules.map((m) => `${m.id}.\n${entries[m.id]?.answer.trim() || "[not answered]"}`).join("\n\n");
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Due ${d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })}`;
}

export function HomeworkPlayer(props: Props) {
  // Drafts live in localStorage, so the editor starts after hydration (same approach as the lesson player).
  const mounted = useMounted();
  if (!mounted) return <div className="min-h-dvh bg-background" aria-busy="true" />;
  return <Player {...props} />;
}

function Player({ slug, title, dueAt, courseCode, courseSlug, spec, answers }: Props) {
  const modules = spec.modules;
  const [init] = useState(() => initialEntries(slug, modules, answers));
  const [entries, setEntries] = useState<Entries>(init.entries);
  const [sync, setSync] = useState<Record<string, Sync>>({});
  const entriesRef = useRef(init.entries);
  const versions = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flush = useCallback(
    async function flushOne(id: string): Promise<void> {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      const e = entriesRef.current[id];
      if (!e) return;
      const version = versions.current.get(id) ?? 0;
      setSync((s) => ({ ...s, [id]: "saving" }));
      let res: Awaited<ReturnType<typeof saveAnswer>>;
      try {
        res = await saveAnswer(slug, id, e.answer, e.status);
      } catch {
        res = { ok: false, reason: "error" };
      }
      if ((versions.current.get(id) ?? 0) !== version) return; // a newer edit has its own save queued
      if (res.ok) {
        setSync((s) => ({ ...s, [id]: "saved" }));
      } else if (res.reason === "error") {
        setSync((s) => ({ ...s, [id]: "retrying" }));
        timers.current.set(id, setTimeout(() => void flushOne(id), RETRY_MS));
      } else {
        // Locked, rejected or invalid: retrying cannot help. The draft stays in localStorage.
        setSync((s) => ({ ...s, [id]: "failed" }));
      }
    },
    [slug],
  );

  const update = (id: string, patch: Partial<Omit<Entry, "updatedAt">>) => {
    const next: Entries = { ...entriesRef.current, [id]: { ...entriesRef.current[id], ...patch, updatedAt: Date.now() } };
    entriesRef.current = next;
    setEntries(next);
    writeDrafts(slug, next);
    versions.current.set(id, (versions.current.get(id) ?? 0) + 1);
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => void flush(id), DEBOUNCE_MS));
    setSync((s) => ({ ...s, [id]: "pending" }));
  };

  // Drafts newer than the server copy go up shortly after load; pending saves go up when the tab is hidden.
  useEffect(() => {
    const t = timers.current;
    for (const id of init.unsaved) t.set(id, setTimeout(() => void flush(id), DEBOUNCE_MS));
    const onHide = () => {
      if (document.visibilityState === "hidden") for (const id of [...t.keys()]) void flush(id);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      for (const timer of t.values()) clearTimeout(timer);
      t.clear();
    };
  }, [flush, init]);

  const [locking, startLock] = useTransition();
  const lock = () =>
    startLock(async () => {
      // Each flush settles (saved or failed) before the drafts go, so nothing stays on a shared device.
      for (const id of [...timers.current.keys()]) await flush(id);
      for (const timer of timers.current.values()) clearTimeout(timer); // no retry may rewrite drafts
      timers.current.clear();
      clearDrafts(slug);
      await lockHomework(slug); // deleting the cookie re-renders the page as the passcode form
    });

  const n = modules.length;
  const got = modules.filter((m) => entries[m.id]?.status === "got").length;
  const review = modules.filter((m) => entries[m.id]?.status === "review").length;
  const answered = modules.filter((m) => entries[m.id]?.answer.trim()).length;
  const states = Object.values(sync);
  const saveLabel = states.some((s) => s === "pending" || s === "saving")
    ? "Saving…"
    : states.includes("retrying")
      ? "Not saved, retrying"
      : states.includes("failed")
        ? "Not saved. Draft kept on this device."
        : states.includes("saved")
          ? "Saved"
          : "";
  const due = formatDue(dueAt);

  return (
    <div className="min-h-dvh bg-background text-foreground" style={courseStyle(courseSlug)}>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href={`/course/${courseSlug}`} aria-label={`Back to ${courseCode}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-control">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-(--course)">{courseCode}</p>
              <h1 className="truncate text-sm font-semibold">{title}</h1>
            </div>
            <ThemeToggle className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" />
            <Button variant="outline" size="sm" onClick={lock} disabled={locking} aria-label="Lock this page on this device">
              <Lock aria-hidden />
              Lock
            </Button>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Questions marked Got it" aria-valuemin={0} aria-valuemax={n} aria-valuenow={got}>
            <div className="h-full bg-good transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(100 * got) / n}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
            <span>{answered} answered</span>
            <span>
              {got} of {n} got it
            </span>
            <span>{review} need review</span>
            {due && <span>{due}</span>}
            <span className="ml-auto" role="status" aria-live="polite" data-testid="save-status">
              {saveLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-5">
        {spec.banner.items.length > 0 && (
          <aside role="note" className="rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm">
            <p className="font-semibold text-warn">{spec.banner.title}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {spec.banner.items.map((item, i) => (
                <li key={i}>
                  <Md text={item} />
                </li>
              ))}
            </ul>
          </aside>
        )}

        {modules.map((m) => (
          <ModuleCard
            key={m.id}
            m={m}
            entry={entries[m.id]}
            onAnswer={(answer) => update(m.id, { answer })}
            onStatus={(status) => update(m.id, { status: entries[m.id]?.status === status ? null : status })}
          />
        ))}

        <ExportPanel getText={() => exportText(modules, entriesRef.current)} />
      </main>
    </div>
  );
}

function ModuleCard({
  m,
  entry,
  onAnswer,
  onStatus,
}: {
  m: HomeworkModule;
  entry: Entry | undefined;
  onAnswer: (answer: string) => void;
  onStatus: (status: HomeworkStatus) => void;
}) {
  const [showSample, setShowSample] = useState(false);
  const answer = entry?.answer ?? "";
  const status = entry?.status ?? null;
  const hasAnswer = answer.trim().length > 0;
  const sampleVisible = showSample && hasAnswer;
  const taId = `ans-${m.id}`;

  return (
    <section
      id={`q${m.id}`}
      aria-labelledby={`${taId}-label`}
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-4 shadow-soft sm:p-5",
        status === "got" ? "border-good" : status === "review" ? "border-warn" : "border-border",
      )}
    >
      <p id={`${taId}-label`} className="font-mono text-xs font-semibold uppercase tracking-wider text-(--course)">
        Question {m.id}
      </p>
      {m.ctx && <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{m.ctx}</p>}
      <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">{m.q}</p>

      <details className="mt-3 border-t border-border pt-2">
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Lecture pointer</summary>
        <p className="mt-1.5 text-sm [overflow-wrap:anywhere]">{m.ptr}</p>
      </details>
      {m.nudge && (
        <details className="mt-2 border-t border-border pt-2">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Nudge</summary>
          <p className="mt-1.5 text-sm [overflow-wrap:anywhere]">{m.nudge}</p>
        </details>
      )}

      <textarea
        id={taId}
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        maxLength={20000}
        aria-label={`Your answer to question ${m.id}`}
        placeholder="Write your own answer here before looking at the sample."
        className="mt-3 min-h-32 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="lg" disabled={!hasAnswer} aria-expanded={sampleVisible} onClick={() => setShowSample((v) => !v)}>
          {sampleVisible ? "Hide sample answer" : "Show sample answer"}
        </Button>
        {!hasAnswer && <span className="text-xs text-muted-foreground">Type an answer to unlock the sample.</span>}
        <div className="ml-auto inline-flex" role="group" aria-label={`Mark question ${m.id}`}>
          <button
            type="button"
            aria-pressed={status === "got"}
            onClick={() => onStatus("got")}
            className={cn(
              "h-9 rounded-l-lg border px-3 text-sm font-medium transition-colors",
              status === "got" ? "border-good bg-good-soft text-good" : "border-border bg-background hover:bg-muted",
            )}
          >
            Got it
          </button>
          <button
            type="button"
            aria-pressed={status === "review"}
            onClick={() => onStatus("review")}
            className={cn(
              "-ml-px h-9 rounded-r-lg border px-3 text-sm font-medium transition-colors",
              status === "review" ? "border-warn bg-warn-soft text-warn" : "border-border bg-background hover:bg-muted",
            )}
          >
            Needs review
          </button>
        </div>
      </div>

      {sampleVisible && (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">Sample answer</p>
          {m.s.map((p, i) =>
            p.startsWith("~") ? (
              <pre key={i} className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                {/* Continuation lines may repeat the "~" marker; it is never part of the math. */}
                {p.slice(1).replace(/^~/gm, "")}
              </pre>
            ) : (
              <p key={i} className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">
                {p}
              </p>
            ),
          )}
        </div>
      )}
    </section>
  );
}

/** Copies only Ryan's answers, in module order. Samples are never included. */
function ExportPanel({ getText }: { getText: () => string }) {
  const [msg, setMsg] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (fallback !== null) {
      boxRef.current?.focus();
      boxRef.current?.select();
    }
  }, [fallback]);

  const copy = async () => {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
      setFallback(null);
      setMsg("Copied your answers.");
    } catch {
      setFallback(text);
      setMsg("Copy blocked here. The text is selected below; press Ctrl/Cmd+C.");
    }
  };

  return (
    <section aria-label="Export my answers" className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <p className="font-semibold">Export my answers</p>
      <p className="mt-1 text-sm text-muted-foreground">Copies only what you typed, in question order. Samples are never included.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={copy}>
          <Copy aria-hidden />
          Copy my answers
        </Button>
        <span role="status" className="text-sm text-good">
          {msg}
        </span>
      </div>
      {fallback !== null && (
        <textarea
          ref={boxRef}
          readOnly
          value={fallback}
          aria-label="Exported answers"
          className="mt-3 min-h-40 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
        />
      )}
    </section>
  );
}
