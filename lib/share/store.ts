/** Share-link storage contract. Two implementations: Supabase (service role) and an in-memory dev/test one. */
export type ShareLinkRow = {
  id: string;
  course_id: string;
  token_hash: string;
  label: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  use_count: number;
};

/** What the owner sees in the panel. Never includes the hash. */
export type ShareLinkSummary = Omit<ShareLinkRow, "token_hash">;

export interface ShareStore {
  insert(row: { course_id: string; token_hash: string; label: string; expires_at: string | null }): Promise<ShareLinkRow>;
  listForCourse(courseId: string): Promise<ShareLinkRow[]>;
  findByHash(tokenHash: string): Promise<ShareLinkRow | null>;
  /** Marks revoked. Scoped to the course so an id from another course does nothing. Returns whether a row changed. */
  revoke(id: string, courseId: string, at: string): Promise<boolean>;
  /** Bumps use_count and last_used_at. */
  touch(id: string, at: string): Promise<void>;
}

export function toSummary(row: ShareLinkRow): ShareLinkSummary {
  const summary: Partial<ShareLinkRow> = { ...row };
  delete summary.token_hash;
  return summary as ShareLinkSummary;
}
