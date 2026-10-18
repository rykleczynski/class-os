import "server-only";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAdmin } from "../supabase/admin";
import { supabaseEnabled } from "../supabase/client";
import { reviewsRoot } from "./paths";
import { practiceSetSchema, type PracticeSet } from "./schema";

/**
 * Generated practice exams, per review. Supabase table generated_exams (0007) with the service role; in fixtures
 * mode, files under content/reviews/<slug>/generated/. No access checks here: callers check the owner first.
 * Rows that no longer parse are skipped, never served.
 */
const dir = (slug: string) => join(reviewsRoot(), slug, "generated");
const parse = (v: unknown): PracticeSet | null => {
  const p = practiceSetSchema.safeParse(v);
  return p.success && p.data.kind === "generated" ? p.data : null;
};

function db() {
  const c = getAdmin();
  if (!c) throw new Error("SUPABASE_SECRET_KEY is not set: generated exams are stored with the service role");
  return c;
}

/** Newest first. Returns [] when the table is missing (migration 0007 not applied), so the review page still loads. */
export async function listGenerated(slug: string): Promise<PracticeSet[]> {
  if (!supabaseEnabled) {
    let files: string[];
    try {
      files = (await readdir(dir(slug))).filter((f) => f.endsWith(".json") && f !== "attempts.json");
    } catch {
      return [];
    }
    const sets = await Promise.all(files.map(async (f) => parse(JSON.parse(await readFile(join(dir(slug), f), "utf8")))));
    return sets.filter((s): s is PracticeSet => s !== null).sort((a, b) => (b.generated?.createdAt ?? "").localeCompare(a.generated?.createdAt ?? ""));
  }
  const { data, error } = await db().from("generated_exams").select("spec").eq("review_slug", slug).order("created_at", { ascending: false });
  if (error) {
    console.error(`generated_exams: ${error.message}`);
    return [];
  }
  return data.map((r) => parse(r.spec)).filter((s): s is PracticeSet => s !== null);
}

/** Fixtures mode: attempt times per review, kept in content/reviews/<slug>/generated/attempts.json. */
const attemptsFile = (slug: string) => join(dir(slug), "attempts.json");
let fixtureLock: Promise<unknown> = Promise.resolve();

/**
 * Reserves one generation attempt for today (UTC) before the model is called. Returns false once `cap` attempts
 * exist today. Attempts are never refunded, so failed calls and deleted exams still count, and the Supabase
 * function serializes concurrent requests (0008). Fixtures mode serializes within this process.
 */
export async function reserveGeneration(slug: string, cap: number): Promise<boolean> {
  if (supabaseEnabled) {
    const { data, error } = await db().rpc("reserve_generation", { p_slug: slug, p_cap: cap });
    if (error) throw new Error(`reserve_generation: ${error.message}`);
    return data === true;
  }
  const run = fixtureLock.then(async () => {
    let times: string[] = [];
    try {
      times = JSON.parse(await readFile(attemptsFile(slug), "utf8")) as string[];
    } catch {
      /* first attempt */
    }
    const today = new Date().toISOString().slice(0, 10);
    if (times.filter((t) => t.startsWith(today)).length >= cap) return false;
    await mkdir(dir(slug), { recursive: true });
    await writeFile(attemptsFile(slug), JSON.stringify([...times, new Date().toISOString()]));
    return true;
  });
  fixtureLock = run.catch(() => {});
  return run;
}

export async function saveGenerated(slug: string, set: PracticeSet): Promise<void> {
  if (!supabaseEnabled) {
    await mkdir(dir(slug), { recursive: true });
    await writeFile(join(dir(slug), `${set.id}.json`), JSON.stringify(set, null, 2));
    return;
  }
  const { error } = await db().from("generated_exams").insert({ review_slug: slug, spec: set });
  if (error) throw new Error(`generated_exams: ${error.message}`);
}

export async function deleteGenerated(slug: string, id: string): Promise<boolean> {
  if (!/^gen-[a-z0-9-]+$/.test(id)) return false;
  if (!supabaseEnabled) {
    try {
      await rm(join(dir(slug), `${id}.json`));
      return true;
    } catch {
      return false;
    }
  }
  const { data, error } = await db().from("generated_exams").delete().eq("review_slug", slug).eq("spec->>id", id).select("id");
  if (error) throw new Error(`generated_exams: ${error.message}`);
  return data.length > 0;
}
