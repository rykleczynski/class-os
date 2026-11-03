/**
 * Homework deck tests: the spec accepts old and new shapes and rejects malformed new fields,
 * the deck comes out in the right order, and a remembered index clamps. All content is invented.
 * Usage: npm run test:homework
 */
import assert from "node:assert/strict";
import { buildDeck, clampCardIndex } from "../lib/homework-deck";
import { homeworkFileSchema, homeworkModuleSchema, homeworkSpecSchema, type HomeworkModule, type HomeworkSpec } from "../lib/homework-spec";

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

const oldModule = (id: string): HomeworkModule => ({ id, q: `How many cups in round ${id}?`, ptr: "Made-up lecture 1.", nudge: null, s: ["Twelve cups.", "~6 * 2\n~= 12"] });
const concept = { title: "Margins", body: ["A **margin** is price minus cost."] };
const spec = (modules: HomeworkModule[], items: string[] = []): HomeworkSpec => ({ banner: { title: "Read first", items }, modules });
const kinds = (s: HomeworkSpec) => buildDeck(s).map((c) => c.kind);

test("an old-shape spec still validates", () => {
  const parsed = homeworkSpecSchema.parse(spec([oldModule("1a"), { ...oldModule("1b"), ctx: "Shared setup.", nudge: "Think small." }]));
  assert.equal(parsed.modules[0].concept, undefined);
  assert.equal(parsed.modules[0].steps, undefined);
});

test("an old-shape file still validates", () => {
  const file = { slug: "made-up-set", courseCode: "ECON 1", title: "Made up", dueAt: null, spec: spec([oldModule("1")]) };
  assert.equal(homeworkFileSchema.safeParse(file).success, true);
});

test("concept and steps validate and survive parsing", () => {
  const parsed = homeworkModuleSchema.parse({ ...oldModule("1"), concept, steps: ["Subtract.", "Multiply."] });
  assert.deepEqual(parsed.concept, concept);
  assert.deepEqual(parsed.steps, ["Subtract.", "Multiply."]);
});

const malformed: Array<[string, Record<string, unknown>]> = [
  ["concept with an empty title", { concept: { title: "", body: ["Text."] } }],
  ["concept with no title", { concept: { body: ["Text."] } }],
  ["concept with an empty body", { concept: { title: "T", body: [] } }],
  ["concept with an empty body string", { concept: { title: "T", body: [""] } }],
  ["concept body that is a string", { concept: { title: "T", body: "Text." } }],
  ["concept that is null", { concept: null }],
  ["empty steps", { steps: [] }],
  ["an empty step", { steps: ["Fine.", ""] }],
  ["steps that are a string", { steps: "Do it." }],
  ["a non-string step", { steps: [1] }],
];
for (const [name, patch] of malformed) {
  test(`rejects ${name}`, () => {
    assert.equal(homeworkModuleSchema.safeParse({ ...oldModule("1"), ...patch }).success, false);
  });
}

test("deck: problems then finish, with no banner items or concepts", () => {
  assert.deepEqual(kinds(spec([oldModule("1"), oldModule("2")])), ["problem", "problem", "finish"]);
});

test("deck: intro comes first when the banner has items", () => {
  const deck = buildDeck(spec([oldModule("1")], ["Round to **two** decimals."]));
  assert.deepEqual(deck.map((c) => c.kind), ["intro", "problem", "finish"]);
  assert.deepEqual(deck[0], { kind: "intro", key: "intro", title: "Read first", items: ["Round to **two** decimals."] });
});

test("deck: a concept sits right before its own module only", () => {
  const deck = buildDeck(spec([oldModule("1"), { ...oldModule("2"), concept }, oldModule("3")], ["Note."]));
  assert.deepEqual(deck.map((c) => c.key), ["intro", "problem:1", "concept:2", "problem:2", "problem:3", "finish"]);
  const card = deck[2];
  assert.ok(card.kind === "concept");
  assert.equal(card.title, concept.title);
  assert.deepEqual(card.body, concept.body);
});

test("deck: keys are unique and stable, even for a module id that looks like a card kind", () => {
  const s = spec([{ ...oldModule("intro"), concept }, oldModule("finish")], ["Note."]);
  const keys = buildDeck(s).map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys, buildDeck(s).map((c) => c.key));
});

test("clamp: in-range values pass through", () => {
  assert.equal(clampCardIndex(0, 5), 0);
  assert.equal(clampCardIndex(4, 5), 4);
});

test("clamp: out-of-range values land on the nearest end", () => {
  assert.equal(clampCardIndex(-3, 5), 0);
  assert.equal(clampCardIndex(5, 5), 4);
  assert.equal(clampCardIndex(999, 5), 4);
});

test("clamp: junk means the first card", () => {
  assert.equal(clampCardIndex(Number.NaN, 5), 0);
  assert.equal(clampCardIndex(Number("not a number"), 5), 0);
  assert.equal(clampCardIndex(Number.POSITIVE_INFINITY, 5), 0);
  assert.equal(clampCardIndex(2.7, 5), 2);
  assert.equal(clampCardIndex(3, 0), 0);
});

if (failed > 0) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll homework deck tests passed.");
