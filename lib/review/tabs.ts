/** Review page tabs. Plain data so the server page can validate ?tab= (a client module export would be a reference). */
export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sheet", label: "Notes sheet" },
  { id: "topics", label: "Topic guide" },
  { id: "practice", label: "Practice exams" },
  { id: "cards", label: "Flashcards" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

export const parseTab = (v: unknown): TabId | undefined => TABS.find((t) => t.id === v)?.id;
