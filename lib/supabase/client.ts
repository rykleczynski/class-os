import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** True when both public Supabase variables are set. Otherwise the app uses fixtures. */
export const supabaseEnabled = Boolean(url && key);

let client: SupabaseClient<Database> | null = null;

/** Anon client using the publishable key. Row level security decides what it can do. */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!supabaseEnabled) return null;
  client ??= createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
