import "server-only";
import { getAdmin } from "../supabase/admin";
import { createMemoryStore } from "./memory-store";
import type { ShareLinkRow, ShareStore } from "./store";

function supabaseStore(): ShareStore | null {
  const db = getAdmin();
  if (!db) return null;
  return {
    async insert(r) {
      const { data, error } = await db.from("share_links").insert(r).select("*").single();
      if (error) throw new Error(`share_links: ${error.message}`);
      return data as ShareLinkRow;
    },
    async listForCourse(courseId) {
      const { data, error } = await db.from("share_links").select("*").eq("course_id", courseId).order("created_at", { ascending: false });
      if (error) throw new Error(`share_links: ${error.message}`);
      return data as ShareLinkRow[];
    },
    async findByHash(hash) {
      const { data, error } = await db.from("share_links").select("*").eq("token_hash", hash).maybeSingle();
      if (error) throw new Error(`share_links: ${error.message}`);
      return (data as ShareLinkRow | null) ?? null;
    },
    async revoke(id, courseId, at) {
      const { data, error } = await db.from("share_links").update({ revoked_at: at }).eq("id", id).eq("course_id", courseId).is("revoked_at", null).select("id");
      if (error) throw new Error(`share_links: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    async touch(id) {
      const { error } = await db.rpc("share_link_touch", { p_id: id });
      if (error) console.error(`share_link_touch: ${error.message}`);
    },
  };
}

const g = globalThis as unknown as { __classosShareMemory?: ReturnType<typeof createMemoryStore> };

/**
 * Where share links live. Supabase when the service role is configured. For local work without
 * Supabase, CLASSOS_DEV_MEMORY_SHARING=1 turns on a throwaway in-memory store (refused in production).
 * Otherwise null, and sharing is off.
 */
export function getShareStore(): ShareStore | null {
  const real = supabaseStore();
  if (real) return real;
  if (process.env.NODE_ENV !== "production" && process.env.CLASSOS_DEV_MEMORY_SHARING === "1") {
    return (g.__classosShareMemory ??= createMemoryStore());
  }
  return null;
}

export const sharingEnabled = () => getShareStore() !== null;
