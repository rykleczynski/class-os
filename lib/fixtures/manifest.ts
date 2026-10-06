/**
 * Lists every lecture that scripts/sync.ts pushes to Supabase.
 * `summary: null` means the sync script uses the lesson JSON's `hook`.
 */
export type ManifestEntry = {
  /** Lesson file name under lib/fixtures/lessons (without .json). */
  slug: string;
  courseCode: string;
  /** Wispr meeting id, or `panopto:<id>`. Stored as lectures.wispr_meeting_id. */
  sourceId: string;
  startsAt: string;
  endsAt: string;
  wisprShareLink: string | null;
  /** File name under lib/fixtures/transcripts, or null. */
  transcriptFile: string | null;
  summary: string | null;
};

export const manifest: ManifestEntry[] = [
  {
    slug: "econ106f-class1",
    courseCode: "ECON 106F",
    sourceId: "1356beff-2254-4e40-bdd0-8f41b0cc0b45",
    startsAt: "2026-09-28T15:00:01Z",
    endsAt: "2026-09-28T16:12:54Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/8akutUCkxVm3Lk6DwsRkUAChbw0JjcwJ7_obcBcVLw0",
    transcriptFile: "econ106f-class1.txt",
    summary: null,
  },
  {
    slug: "econ106f-class2",
    courseCode: "ECON 106F",
    sourceId: "fdd5557d-154b-4cba-9146-3670615d5b2d",
    startsAt: "2026-09-30T15:00:11Z",
    endsAt: "2026-09-30T16:09:50Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/YAEd_edkhOQztcpp88GLin5a5YfjYQRdUniGJj2jOwI",
    transcriptFile: "econ106f-class2.txt",
    summary: null,
  },
  {
    slug: "econ106f-class3",
    courseCode: "ECON 106F",
    sourceId: "2b8f0773-fb67-4389-9551-ff835a6b9f8a",
    startsAt: "2026-10-05T15:00:20Z",
    endsAt: "2026-10-05T16:07:58Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/SGM_CQ-BnLpOzHMgAz0Apu9oKuvzE0FBAf7ObPjFKIU",
    transcriptFile: "econ106f-class3.txt",
    summary: "Value vs price, the NPV decision rule, and the first look at time value of money.",
  },
  {
    slug: "econ106fb-disc1",
    courseCode: "ECON 106FB",
    sourceId: "c32dac2b-4f52-4e5d-9c63-f2d8353fd5b3",
    startsAt: "2026-10-01T23:03:11Z",
    endsAt: "2026-10-01T23:49:55Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/TKw6mDvu-gOdIXp855TxPn3Z_tdBVscWkla7d8uGEaA",
    transcriptFile: "econ106fb-disc1.txt",
    summary: null,
  },
  {
    slug: "comm187-class2",
    courseCode: "COMM 187",
    sourceId: "b37a2cf8-0222-4b4d-b572-6e31617bc5a6",
    startsAt: "2026-09-30T16:31:53Z",
    endsAt: "2026-09-30T17:45:33Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/Tjd19PyE7eqRnCjuohs6B4U1nb5I1PLNcl68SSLixfk",
    transcriptFile: "comm187-class2.txt",
    summary: null,
  },
  {
    slug: "comm187-class3",
    courseCode: "COMM 187",
    sourceId: "9d6e4625-fd96-4a72-88a4-ddfb72888a8c",
    startsAt: "2026-10-05T16:30:47Z",
    endsAt: "2026-10-05T17:44:14Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/hB4i6GY_ZHhvg8Uin8e82Uv2ak0P4VSUA6LPGPn0lKA",
    transcriptFile: null,
    summary: "Fairness, personal vs professional ethics, objectivity, and conflicts of interest.",
  },
  {
    slug: "econ134-class1",
    courseCode: "ECON 134",
    sourceId: "9597e442-c9bf-495c-83dc-8ae39f6fb5c7",
    startsAt: "2026-09-28T20:57:15Z",
    endsAt: "2026-09-28T22:08:33Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/6vm_-9f48_n4TmdLeSEXCv9dDOfxvfb5D7v0GVR7MYQ",
    transcriptFile: "econ134-class1.txt",
    summary: null,
  },
  {
    slug: "econ134-class2",
    courseCode: "ECON 134",
    sourceId: "a24fbb12-7088-4e7a-bf8d-93a5860a9ec3",
    startsAt: "2026-09-30T21:00:24Z",
    endsAt: "2026-09-30T22:11:25Z",
    wisprShareLink: "https://notes.wisprflow.ai/shared/s4818ma6-hboNRcV2lnOM6x2Up7k-XJN9mh0IyaI41U",
    transcriptFile: "econ134-class2.txt",
    summary: null,
  },
  {
    slug: "econ134-2026-10-05",
    courseCode: "ECON 134",
    sourceId: "panopto:9262a62d-4c3d-4ffd-8d9f-b4da0171b541",
    startsAt: "2026-10-05T14:00:00-07:00",
    endsAt: "2026-10-05T15:15:00-07:00",
    wisprShareLink: null,
    transcriptFile: "econ134-2026-10-05.txt",
    summary: "Pigouvian taxes at marginal damage, who gets the revenue, and the Coase theorem with what breaks it.",
  },
];
