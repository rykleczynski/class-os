/**
 * Read-only status checks for the generator, using the publishable key only.
 *
 *   npm run status -- --course "ECON 106F" --start <ISO> --end <ISO>
 *       prints "lesson <slug>", "lecture-without-lesson" or "none"
 *   npm run status -- --upcoming [days]
 *       prints assessments due within N days (default 14) as JSON
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const arg = (n: string) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("status: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set (.env.generator)");
  process.exit(4);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  if (args.includes("--upcoming")) {
    const days = Number(args[args.indexOf("--upcoming") + 1]) || 14;
    const now = new Date();
    const { data, error } = await db
      .from("assessments")
      .select("kind, title, due_at, weight, coverage, format, courses(code)")
      .gte("due_at", now.toISOString())
      .lte("due_at", new Date(now.getTime() + days * 86400_000).toISOString())
      .order("due_at");
    if (error) { console.error(`status: ${error.message}`); process.exit(4); }
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  const course = arg("--course"), start = arg("--start"), end = arg("--end");
  if (!course || !start || !end) {
    console.error('usage: status --course "ECON 106F" --start <ISO> --end <ISO> | --upcoming [days]');
    process.exit(2);
  }
  const s = Date.parse(start), e = Date.parse(end);
  const { data, error } = await db
    .from("lectures")
    .select("id, starts_at, courses!inner(code)")
    .eq("courses.code", course)
    .gte("starts_at", new Date(s - 30 * 60_000).toISOString())
    .lte("starts_at", new Date(e).toISOString());
  if (error) { console.error(`status: ${error.message}`); process.exit(4); }
  if (!data?.length) { console.log("none"); return; }
  const { data: lessons, error: lErr } = await db.from("lessons").select("slug").in("lecture_id", data.map((l) => l.id as string));
  if (lErr) { console.error(`status: ${lErr.message}`); process.exit(4); }
  console.log(lessons?.length ? `lesson ${lessons[0].slug}` : "lecture-without-lesson");
}
void main();
