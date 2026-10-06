import type { Lesson } from "../lesson/schema";
import comm187Class2 from "./lessons/comm187-class2.json";
import comm187Class3 from "./lessons/comm187-class3.json";
import econ106fClass1 from "./lessons/econ106f-class1.json";
import econ106fClass2 from "./lessons/econ106f-class2.json";
import econ106fClass3 from "./lessons/econ106f-class3.json";
import econ106fbDisc1 from "./lessons/econ106fb-disc1.json";
import econ134Oct5 from "./lessons/econ134-2026-10-05.json";
import econ134Class1 from "./lessons/econ134-class1.json";
import econ134Class2 from "./lessons/econ134-class2.json";

/** Lesson JSON by manifest slug. Add a file here when you add a manifest entry. */
export const lessonsBySlug: Record<string, Lesson> = {
  "comm187-class2": comm187Class2 as Lesson,
  "comm187-class3": comm187Class3 as Lesson,
  "econ106f-class1": econ106fClass1 as Lesson,
  "econ106f-class2": econ106fClass2 as Lesson,
  "econ106f-class3": econ106fClass3 as Lesson,
  "econ106fb-disc1": econ106fbDisc1 as Lesson,
  "econ134-2026-10-05": econ134Oct5 as Lesson,
  "econ134-class1": econ134Class1 as Lesson,
  "econ134-class2": econ134Class2 as Lesson,
};
