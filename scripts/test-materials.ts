/**
 * Test for scripts/materials.ts against a temp Downloads dir with fake files. Usage: npm run test:materials
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileMaterials } from "./materials";

let failed = 0;
const ok = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!pass) failed++;
};

const tmp = mkdtempSync(join(tmpdir(), "classos-materials-"));
const downloads = join(tmp, "Downloads");
const dest = join(tmp, "materials");
mkdirSync(downloads);
const put = (name: string, body: string) => writeFileSync(join(downloads, name), body);

put("Econ 106F Chapter 4 Slides.pdf", "chapter four");
put("Econ 106F Chapter 4 Slides (1).pdf", "chapter four"); // same bytes, different name
put("Econ 106F Syllabus.pdf", "syllabus");
put("Econ 106F Lab Syllabus.docx", "lab syllabus");
put("TA Notes 106F week 2.pdf", "ta notes");
put("Econ 134 Lecture 5 Externalities.pdf", "e134"); // matches the fake pattern below
put("Econ 106F Chapter 4 notes.txt", "wrong extension");
put("Dinner Menu.pdf", "unrelated");

const run = () => {
  const r = spawnSync("npx", ["tsx", join(__dirname, "materials.ts")], {
    env: { ...process.env, CLASSOS_DOWNLOADS: downloads, CLASSOS_MATERIALS_DIR: dest },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout.trim().split("\n").filter(Boolean) };
};
const list = (slug: string) => (existsSync(join(dest, slug)) ? readdirSync(join(dest, slug)).sort() : []);

// 1. End to end with the real course config.
const first = run();
ok("exits 0", first.code === 0);
ok("106F chapter file copied", list("econ-106f").includes("Econ 106F Chapter 4 Slides.pdf"));
ok("106F syllabus copied", list("econ-106f").includes("Econ 106F Syllabus.pdf"));
ok("lab syllabus goes to 106FB only", list("econ-106fb").includes("Econ 106F Lab Syllabus.docx") && !list("econ-106f").includes("Econ 106F Lab Syllabus.docx"));
ok("TA notes go to 106FB", list("econ-106fb").includes("TA Notes 106F week 2.pdf"));
ok("renamed duplicate skipped", !list("econ-106f").includes("Econ 106F Chapter 4 Slides (1).pdf"));
ok("non-matching file ignored", !readdirSync(dest).some((d) => list(d).includes("Dinner Menu.pdf")));
ok("wrong extension ignored", !list("econ-106f").includes("Econ 106F Chapter 4 notes.txt"));
ok("ECON 134 never copied (real config)", !existsSync(join(dest, "econ-134")));
ok("one line per new file", first.out.length === 4, `${first.out.length} lines`);

// 2. Second run: everything is a duplicate.
const second = run();
ok("second run copies nothing", second.code === 0 && second.out.length === 0, `${second.out.length} lines`);

// 3. Opted-out course whose pattern matches must still never be copied.
const dest2 = join(tmp, "materials2");
const filed = fileMaterials(
  downloads,
  dest2,
  [{ slug: "econ-134", code: "ECON 134", materials_allowed: false, materials_patterns: ["Econ 134"] }],
);
ok("opted-out course copies nothing even when the pattern matches", filed.length === 0 && !existsSync(join(dest2, "econ-134")));

// 4. Missing Downloads dir is fine.
ok("missing downloads dir is safe", fileMaterials(join(tmp, "nope"), dest2).length === 0);

rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
