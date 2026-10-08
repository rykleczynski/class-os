/** Tests for isUnsynced / markSynced in a temp directory. No network, no real content/. */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isUnsynced, markSynced } from "./content-state";

let failed = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failed++;
};

const lessonDir = join(__dirname, "..", "lib", "fixtures", "lessons");
const lessonText = readFileSync(join(lessonDir, readdirSync(lessonDir).filter((f) => f.endsWith(".json")).sort()[0]), "utf8");
const slug = "econ106f-2026-10-07";
const meta = (over: object = {}) =>
  JSON.stringify({ slug, courseCode: "ECON 106F", sourceId: "x", startsAt: "a", endsAt: "b", wisprShareLink: null, transcriptFile: null, summary: null, ...over });

const root = mkdtempSync(join(tmpdir(), "classos-state-"));
const dir = join(root, slug);
mkdirSync(dir);
try {
  ok("no files: not unsynced", !isUnsynced(root, slug));
  writeFileSync(join(dir, "lesson.json"), lessonText);
  writeFileSync(join(dir, "meta.json"), meta());
  ok("valid pair, no marker: unsynced", isUnsynced(root, slug));
  markSynced(root, slug);
  ok("after markSynced: synced", !isUnsynced(root, slug));
  writeFileSync(join(dir, "transcript.txt"), "hello");
  ok("transcript.txt added after sync: unsynced", isUnsynced(root, slug));
  markSynced(root, slug);
  ok("re-marked: synced", !isUnsynced(root, slug));
  writeFileSync(join(dir, "transcript.txt"), "hello again");
  ok("transcript.txt changed: unsynced", isUnsynced(root, slug));
  markSynced(root, slug);
  writeFileSync(join(dir, "transcript.txt"), "hello again"); // same bytes, newer mtime
  ok("same transcript bytes: still synced", !isUnsynced(root, slug));
  writeFileSync(join(dir, "other.txt"), "x");
  writeFileSync(join(dir, "meta.json"), meta({ transcriptFile: "other.txt" }));
  ok("meta.transcriptFile changed: unsynced", isUnsynced(root, slug));
  markSynced(root, slug);
  writeFileSync(join(dir, "other.txt"), "y");
  ok("referenced transcript changed: unsynced", isUnsynced(root, slug));

  // Files sync would reject must not block the generator.
  rmSync(join(dir, ".synced"));
  writeFileSync(join(dir, "meta.json"), "{ not json");
  ok("malformed meta.json: not unsynced", !isUnsynced(root, slug));
  writeFileSync(join(dir, "meta.json"), meta({ slug: "other-slug" }));
  ok("meta slug mismatch: not unsynced", !isUnsynced(root, slug));
  writeFileSync(join(dir, "meta.json"), meta());
  writeFileSync(join(dir, "lesson.json"), '{"title":"x"}');
  ok("schema-invalid lesson.json: not unsynced", !isUnsynced(root, slug));
} finally {
  rmSync(root, { recursive: true, force: true });
}
if (failed) process.exit(1);
console.log("all content-state tests passed");
