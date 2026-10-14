import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role client. Bypasses row level security, so it is the only way the app reads
 * content or share links after migration 0004. Server only: this file imports "server-only",
 * and SUPABASE_SECRET_KEY must never be a NEXT_PUBLIC variable. Callers decide who may read
 * (owner session in lib/auth.ts, or a validated share token in lib/share/service.ts).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

export const adminEnabled = Boolean(url && secret);

let client: SupabaseClient<Database> | null = null;

export function getAdmin(): SupabaseClient<Database> | null {
  if (!adminEnabled) return null;
  client ??= createClient<Database>(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
