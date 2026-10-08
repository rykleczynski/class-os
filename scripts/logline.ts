/**
 * Appends one line to content/_log/<date>.log: `<iso time> <slug> <outcome> <seconds>s [note]`.
 * Never log lesson or transcript content. Outcomes are a fixed set.
 *
 *   npm run logline -- <slug> <outcome> [seconds] [short note]
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTCOMES = ["generated", "no-recording", "cancelled", "exam", "holiday", "already-done", "failed", "dry-run", "awaiting-panopto"] as const;
const [slug, outcome, secs, ...note] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug) || !OUTCOMES.includes(outcome as (typeof OUTCOMES)[number])) {
  console.error(`usage: logline <slug> <${OUTCOMES.join("|")}> [seconds] [note]`);
  process.exit(2);
}
const dir = join(__dirname, "..", "content", "_log");
mkdirSync(dir, { recursive: true });
const now = new Date();
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
const line = [now.toISOString(), slug, outcome, `${Number(secs) || 0}s`, note.join(" ").slice(0, 120)].filter(Boolean).join(" ");
appendFileSync(join(dir, `${day}.log`), line + "\n");
