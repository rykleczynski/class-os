export type ExpiryChoice = "none" | "7d" | "30d" | "term";

export const EXPIRY_CHOICES: { value: ExpiryChoice; label: string }[] = [
  { value: "none", label: "No expiry" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "term", label: "End of term (Dec 8)" },
];

/** End of Dec 8, 2026 in Los Angeles (PST, UTC-8) is 08:00 UTC on Dec 9. Matches TERM_END in lib/schedule.ts. */
export const TERM_END_EXPIRY = "2026-12-09T08:00:00.000Z";

/** Absolute expiry for a choice, or null for none. Throws on an unknown choice or a term end that has passed. */
export function expiryFor(choice: string, now: Date): string | null {
  const day = 86400_000;
  switch (choice) {
    case "none":
      return null;
    case "7d":
      return new Date(now.getTime() + 7 * day).toISOString();
    case "30d":
      return new Date(now.getTime() + 30 * day).toISOString();
    case "term":
      if (Date.parse(TERM_END_EXPIRY) <= now.getTime()) throw new Error("The term has ended");
      return TERM_END_EXPIRY;
    default:
      throw new Error("Unknown expiry");
  }
}
