import { randomUUID } from "node:crypto";
import type { ShareLinkRow, ShareStore } from "./store";

/** Volatile store for tests and for local screenshots. Never wired up in production (see lib/share/index.ts). */
export function createMemoryStore(): ShareStore & { rows: ShareLinkRow[] } {
  const rows: ShareLinkRow[] = [];
  return {
    rows,
    async insert(r) {
      const row: ShareLinkRow = { id: randomUUID(), created_at: new Date().toISOString(), revoked_at: null, last_used_at: null, use_count: 0, ...r };
      rows.push(row);
      return { ...row };
    },
    async listForCourse(courseId) {
      return rows.filter((r) => r.course_id === courseId).map((r) => ({ ...r })).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async findByHash(hash) {
      const r = rows.find((x) => x.token_hash === hash);
      return r ? { ...r } : null;
    },
    async revoke(id, courseId, at) {
      const r = rows.find((x) => x.id === id && x.course_id === courseId && !x.revoked_at);
      if (!r) return false;
      r.revoked_at = at;
      return true;
    },
    async touch(id, at) {
      const r = rows.find((x) => x.id === id);
      if (r) {
        r.use_count += 1;
        r.last_used_at = at;
      }
    },
  };
}
