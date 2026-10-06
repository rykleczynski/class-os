import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { lessonSchema } from "../lib/lesson/schema";

const json = z.toJSONSchema(lessonSchema, { target: "draft-7", io: "input" });
const out = join(__dirname, "..", "lib", "lesson", "lesson.schema.json");
writeFileSync(out, JSON.stringify(json, null, 2) + "\n");
console.log(`wrote ${out}`);
