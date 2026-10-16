/**
 * Exam review tests: the schema's cross-reference checks, lint, assembly from a frame and parts,
 * transcript cleaning, exam-signal extraction, and the materials opt-out. No network; temp dirs only.
 * Usage: npm run test:review
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courses } from "../lib/fixtures/courses";
import { assembleReview, balanceSides, reviewFrameSchema, reviewPartSchema, type ReviewFrame, type ReviewPart } from "../lib/review/assemble";
import { reviewErrors, reviewLint, reviewSchema, type ReviewSection } from "../lib/review/schema";
import { buildBundle, cleanTranscript, examSignals, renderBundle } from "../lib/review/sources";
import { parseTab } from "../lib/review/tabs";

const econ134 = courses.find((c) => c.code === "ECON 134")!;
const econ106 = courses.find((c) => c.code === "ECON 106F")!;

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n  ${e instanceof Error ? e.message : String(e)}`);
  }
}

const mcq = (id: string, answer: number) => ({ type: "mcq" as const, id, q: `Question ${id}?`, options: ["alpha one", "beta two", "gamma three"], answer, why: "Because." });

const section = (id: string, lectures: string[], weight: ReviewSection["weight"] = "high"): ReviewSection => ({
  id,
  title: `Section ${id}`,
  lectures,
  weight,
  weightWhy: "Lots of class time.",
  summary: "Summary.",
  concepts: [{ term: "Externality", definition: "An effect on someone outside the decision." }],
  formulas: [{ name: "First best", expr: "Pi'(Q) = D'(Q)", meaning: "Marginal profit equals marginal damage." }],
  blocks: [],
  workedExamples: [{ title: "Solve", prompt: "Find Q.", steps: [{ title: "FOC", text: "Set equal." }, { title: "Solve", text: "Q = 40.", math: "60 - Q = 0.5Q" }], answer: "40" }],
  pitfalls: ["Mixing up Q_M and Q_FB."],
  quotes: [],
  checks: [mcq(`${id}-c1`, 0), mcq(`${id}-c2`, 1)],
});

const question = (id: string, sectionIds: string[]) => ({
  id,
  sectionIds,
  title: `Q ${id}`,
  setup: "Setup.",
  parts: [
    { label: "a", prompt: "Do a.", points: 5 },
    { label: "b", prompt: "Do b.", points: 5 },
  ],
  solutions: ["A.", "B."],
  rubric: ["Correct FOC."],
});

const part = (ids: string[], dates: string[], qIds: string[]): ReviewPart =>
  reviewPartSchema.parse({
    sections: ids.map((id, i) => section(id, [dates[i]])),
    practiceQuestions: qIds.map((q, i) => question(q, [ids[i % ids.length]])),
    flashcards: ids.flatMap((id) => Array.from({ length: 10 }, (_, k) => ({ sectionId: id, front: `F${k}`, back: `B${k}` }))),
    selfCheck: ids.flatMap((id) => Array.from({ length: 5 }, (_, k) => ({ sectionId: id, item: `I can ${k}` }))),
    notesSheet: ids.map((id) => ({ heading: id, lines: ["line 1", "line 2", "line 3"] })),
  });

const frame: ReviewFrame = reviewFrameSchema.parse({
  schema_version: 1,
  slug: "econ134-midterm-1",
  courseCode: "ECON 134",
  title: "ECON 134 Midterm 1 review",
  generatedAt: "2026-10-15T20:00:00-07:00",
  exam: {
    title: "Midterm 1",
    kind: "midterm",
    startsAt: "2026-10-19T14:00:00-07:00",
    format: ["One double-sided notes sheet."],
    scope: {
      summary: "The first six lectures.",
      lectures: [
        { date: "2026-09-28", title: "Externalities", lessonSlug: "econ134-class1", topics: ["externality"] },
        { date: "2026-09-30", title: "Welfare", lessonSlug: "econ134-class2", topics: ["Pareto"] },
      ],
      evidence: [{ source: "lecture", date: "2026-10-14", quote: "It's covering the six lectures we've had before.", meaning: "Scope." }],
      excluded: ["Informational public goods"],
      gaps: [],
    },
  },
  studyPlan: [{ when: "Thu", tasks: ["Read"] }],
  bigPicture: "Market failure and how to fix it.",
  connections: [],
  practiceExam: { instructions: "75 minutes.", minutes: 75, questions: [question("cross-1", ["ext"])], order: ["cross-1"], drop: [] },
  notesSheet: { allowance: "One sheet, both sides.", sides: 2, lead: [{ heading: "Lead", lines: ["first"] }] },
});

const parts = [part(["ext"], ["2026-09-28"], ["ext-q1"]), part(["welfare"], ["2026-09-30"], ["welfare-q1"])];

test("an assembled review passes the schema", () => {
  const r = reviewSchema.safeParse(assembleReview(frame, parts));
  assert.ok(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3)));
  assert.equal(r.data.sections.length, 2);
  assert.equal(r.data.flashcards.length, 20);
});

test("practice order puts listed ids first and keeps part order for the rest", () => {
  const r = assembleReview(frame, parts);
  assert.deepEqual(r.practiceExam.questions.map((q) => q.id), ["cross-1", "ext-q1", "welfare-q1"]);
});

test("drop removes questions from the practice exam", () => {
  const r = assembleReview({ ...frame, practiceExam: { ...frame.practiceExam, drop: ["ext-q1"] } }, parts);
  assert.deepEqual(r.practiceExam.questions.map((q) => q.id), ["cross-1", "welfare-q1"]);
});

test("notes sheet: lead block first, split across the requested sides", () => {
  const r = assembleReview(frame, parts);
  assert.equal(r.notesSheet.sides.length, 2);
  assert.equal(r.notesSheet.sides[0][0].heading, "Lead");
});

test("balanceSides keeps order and balances line counts", () => {
  const blocks = [5, 5, 5, 5].map((n, i) => ({ heading: `h${i}`, lines: Array(n).fill("x") }));
  const sides = balanceSides(blocks, 2);
  assert.deepEqual(sides.map((s) => s.map((b) => b.heading)), [["h0", "h1"], ["h2", "h3"]]);
  assert.equal(balanceSides(blocks.slice(0, 1), 3).length, 1, "never emits empty sides");
});

test("a section lecture outside the exam scope is rejected", () => {
  const bad = assembleReview(frame, [part(["ext"], ["2026-10-30"], ["ext-q1"])]);
  const r = reviewSchema.safeParse(bad);
  assert.ok(!r.success);
  assert.ok(r.error.issues.some((i) => i.message.includes("not in exam.scope.lectures")));
});

test("unknown section ids in questions, flashcards and self-checks are rejected", () => {
  const r0 = assembleReview(frame, parts);
  const bad = { ...r0, flashcards: [...r0.flashcards, { sectionId: "nope", front: "f", back: "b" }], practiceExam: { ...r0.practiceExam, questions: [...r0.practiceExam.questions, question("x", ["ghost"])] } };
  const r = reviewSchema.safeParse(bad);
  assert.ok(!r.success);
  const msgs = r.error.issues.map((i) => i.message);
  assert.ok(msgs.includes("unknown section nope"));
  assert.ok(msgs.includes("unknown section ghost"));
});

test("mock ids pass through assembly and must name real questions", () => {
  const ok = reviewSchema.parse(assembleReview({ ...frame, practiceExam: { ...frame.practiceExam, mock: ["welfare-q1", "cross-1"] } }, parts));
  assert.deepEqual(ok.practiceExam.mock, ["welfare-q1", "cross-1"]);
  const bad = reviewSchema.safeParse(assembleReview({ ...frame, practiceExam: { ...frame.practiceExam, mock: ["ghost-q"] } }, parts));
  assert.ok(!bad.success && bad.error.issues.some((i) => i.message === "unknown question ghost-q"));
});

test("a question needs one solution per part", () => {
  const r0 = assembleReview(frame, parts);
  const q = { ...question("short", ["ext"]), solutions: ["only one"] };
  const r = reviewSchema.safeParse({ ...r0, practiceExam: { ...r0.practiceExam, questions: [...r0.practiceExam.questions, q] } });
  assert.ok(!r.success && r.error.issues.some((i) => i.message === "one solution per part"));
});

test("block checks: a bad slider formula and an out-of-range answer are errors", () => {
  const s = section("ext", ["2026-09-28"]);
  s.blocks = [{ type: "slider", formula: "evaluate(1)", vars: [{ name: "q", label: "Q", min: 0, max: 10, step: 1, default: 1 }], output: { label: "Out", format: "number" } }];
  s.checks = [{ ...mcq("ext-c1", 0), answer: 7 }, mcq("ext-c2", 1)];
  const errs = reviewErrors([s]);
  assert.ok(errs.some((e) => e.startsWith("ext block 0 (slider)")));
  assert.ok(errs.some((e) => e.startsWith("ext check 0: answer index out of range")));
});

test("lint flags an uncovered high-weight section and an unused in-scope lecture", () => {
  const r = assembleReview({ ...frame, practiceExam: { ...frame.practiceExam, questions: [], drop: ["welfare-q1"] } }, [parts[0]]);
  const ok = reviewSchema.parse({ ...r, practiceExam: { ...r.practiceExam, questions: [question("a", ["ext"]), question("b", ["ext"]), question("c", ["ext"])] } });
  const w = reviewLint(ok);
  assert.ok(w.includes("lecture 2026-09-30 is in scope but no section uses it"));
  const welfareOnly = [question("w2", ["welfare"]), question("w3", ["welfare"])];
  const ok2 = reviewSchema.parse(assembleReview({ ...frame, practiceExam: { ...frame.practiceExam, drop: ["ext-q1"], questions: welfareOnly } }, parts));
  assert.ok(reviewLint(ok2).includes("ext: high-weight section has no practice question"));
});

test("cleanTranscript drops SRT indices, timestamps, bullets and blank lines", () => {
  const raw = "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:05,000 --> 00:00:06,000\n•\tSecond line\n00:12\n";
  assert.equal(cleanTranscript(raw), "Hello there.\nSecond line");
});

test("examSignals finds midterm mentions and merges overlapping windows", () => {
  const t = ["a", "b", "we have a midterm next Monday", "c", "you get one sheet of paper", "d", "e", "f", "g", "h", "i"].join("\n");
  const s = examSignals([{ date: "2026-10-14", lessonSlug: null, lesson: null, transcript: t }], 1);
  assert.equal(s.length, 1, "two mentions two lines apart merge into one window");
  assert.equal(s[0].line, 3, "line points at the first matching line (1-based)");
  assert.ok(s[0].context.join(" ").includes("sheet of paper"));
  assert.ok(!s[0].context.includes("g"));
});

test("bundle: ECON 134 never lists materials, a slides course does; window and missing lessons", () => {
  const dir = mkdtempSync(join(tmpdir(), "review-"));
  try {
    const content = join(dir, "content");
    mkdirSync(join(content, "econ134-2026-10-14"), { recursive: true });
    writeFileSync(join(content, "econ134-2026-10-14", "transcript.txt"), "1\n00:00:01,000 --> 00:00:02,000\nWe have a midterm next Monday.\n");
    mkdirSync(join(content, "econ134-2026-11-30"), { recursive: true });
    writeFileSync(join(content, "econ134-2026-11-30", "transcript.txt"), "Later lecture.\n");
    mkdirSync(join(dir, "materials", "econ-134"), { recursive: true });
    writeFileSync(join(dir, "materials", "econ-134", "syllabus.pdf"), "x");
    mkdirSync(join(dir, "materials", "econ-106f"), { recursive: true });
    writeFileSync(join(dir, "materials", "econ-106f", "Syllabus.pdf"), "x");

    const b = buildBundle(econ134, { repoRoot: dir, contentRoot: content, from: "2026-09-28", to: "2026-10-14" });
    assert.equal(b.materials, null, "opted-out course: materials are never listed");
    assert.deepEqual(b.lectures.map((l) => l.date), ["2026-10-14"], "later lecture is outside the window");
    assert.equal(b.lectures[0].lessonSlug, null);
    assert.equal(b.signals.length, 1);
    const files = renderBundle(econ134, b, { slug: "econ134-midterm-1", title: "Midterm 1", from: "2026-09-28", to: "2026-10-14" });
    assert.ok(files["README.md"].includes("Do not read materials/econ-134/"));
    assert.ok(!files["README.md"].includes("syllabus.pdf"));
    assert.equal(files["transcripts/2026-10-14.txt"], "We have a midterm next Monday.\n");

    const b106 = buildBundle(econ106, { repoRoot: dir, contentRoot: content, from: "2026-09-28", to: "2026-10-14" });
    assert.deepEqual(b106.materials, [join("materials", "econ-106f", "Syllabus.pdf")]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseTab accepts known tabs only", () => {
  assert.equal(parseTab("practice"), "practice");
  assert.equal(parseTab("../etc"), undefined);
  assert.equal(parseTab(undefined), undefined);
});

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
