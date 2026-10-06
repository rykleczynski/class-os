export type Course = {
  id: string;
  code: string;
  slug: string;
  title: string;
  category: string;
  instructor: string | null;
  schedule: string;
  color: string;
  /** "light" means white text on the card, "dark" means near-black text. */
  tone: "light" | "dark";
  /** Recurring Google Calendar series ids (" Class Schedule" calendar). */
  calendar_event_series_ids: string[];
  aliases: string[];
  term: string;
  generation_notes: string;
};

export const courses: Course[] = [
  {
    id: "c-econ106f",
    code: "ECON 106F",
    slug: "econ-106f",
    title: "Finance",
    category: "Finance",
    instructor: "Convery",
    schedule: "Mon/Wed 8:00-9:15",
    color: "#3b5bdb",
    tone: "light",
    calendar_event_series_ids: ["_64p2qb9h74s3cd9n6so34b9h"],
    aliases: ["Econ 106F", "Econ 106F Lecture", "ECON 106F Finance"],
    term: "Fall 2026",
    generation_notes:
      "Quantitative. Lean on formulas as steppers (walk one calculation a frame at a time), sliders with a plot for anything that depends on a rate or a quantity (NPV vs discount rate, PV vs years), and cash-flow timelines with signed amounts. Use the professor's phrases as quotes (\"a bucket of cash today\"). Keep the arithmetic exact and show it.",
  },
  {
    id: "c-comm187",
    code: "COMM 187",
    slug: "comm-187",
    title: "Ethical & Policy Issues in Mass Communication",
    category: "Media Ethics",
    instructor: "Newton",
    schedule: "Mon/Wed 9:30-10:45",
    color: "#ee6a3c",
    tone: "light",
    calendar_event_series_ids: ["qpruvqppuu5vv3l7fou1iqm2jc"],
    aliases: ["Comms 187", "Comm 187", "COMM 187 Media Ethics"],
    term: "Fall 2026",
    generation_notes:
      "No slides and no recording besides the transcript, so the transcript is the only record. Prefer scenario/dilemma cards (give the professor's cases as choices with outcomes and a debrief), case timelines, and sortOrMatch for definitions (disclosure vs recusal, personal vs professional ethics). Quote the professor's tests and rules of thumb. Avoid inventing facts about real people beyond what was said.",
  },
  {
    id: "c-econ134",
    code: "ECON 134",
    slug: "econ-134",
    title: "Environmental Economics",
    category: "Economics",
    instructor: "Rafey",
    schedule: "Mon/Wed 2:00-3:15",
    color: "#16181d",
    tone: "light",
    // TODO: this is the Wednesday series. The Monday 2:00 slot may be a separate series; find its id and add it here.
    calendar_event_series_ids: ["_64p2qc9h68o3gc9k6kqiqc8"],
    aliases: ["Econ 134", "Econ 134 Environmental"],
    term: "Fall 2026",
    generation_notes:
      "Graphical. Use supplyDemand blocks with shifts and shaded areas (deadweight loss, externalities, taxes), marginal-damage versus marginal-benefit curves, and charts of costs. Pair every curve with a one-line takeaway.",
  },
  {
    id: "c-econ106fb",
    code: "ECON 106FB",
    slug: "econ-106fb",
    title: "Finance Laboratory",
    category: "Finance Lab",
    instructor: null,
    schedule: "Thu 4:00 lab, Fri 3:00 lecture",
    color: "#9bd84e",
    tone: "dark",
    calendar_event_series_ids: ["_64p2qb9n64r3cdho74p38b9h", "_64p2qb9o60pjic1g68p36b9h"],
    aliases: ["Econ 106F Discussion", "Econ 106FB", "Econ 106F Lab"],
    term: "Fall 2026",
    generation_notes:
      "Applied case work. Reuse the ECON 106F toolkit (steppers, sliders with plots, timelines) but organize around the lab case: state the decision, the cash flows, then the answer. Link back to the concept from the lecture.",
  },
];

export const courseBySlug = (slug: string) => courses.find((c) => c.slug === slug);
export const courseByCode = (code: string) => courses.find((c) => c.code === code);

/** Map a Wispr meeting title to a course, using codes and aliases (case-insensitive, longest alias first). */
export function matchCourseByTitle(title: string): Course | undefined {
  const t = title.toLowerCase();
  const candidates = courses.flatMap((c) =>
    [c.code, ...c.aliases].map((a) => ({ c, a: a.toLowerCase() })),
  );
  candidates.sort((x, y) => y.a.length - x.a.length);
  return candidates.find(({ a }) => t.includes(a))?.c;
}
