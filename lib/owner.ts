/** Pure owner-email rules, kept free of Next imports so the tests can load them. */
export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/** True only when OWNER_EMAIL is set and the address matches it exactly (case-insensitive). */
export function isOwnerEmail(email: unknown, ownerEmail: string | undefined = process.env.OWNER_EMAIL): boolean {
  const owner = normalizeEmail(ownerEmail);
  return owner !== "" && normalizeEmail(email) === owner;
}

/**
 * Local development without Supabase env: fixtures, no sign-in. Never true in production, so a
 * deploy that lost its env variables fails closed instead of opening up.
 */
export function devBypassAllowed(env: { NODE_ENV?: string; supabaseEnabled: boolean }): boolean {
  return env.NODE_ENV !== "production" && !env.supabaseEnabled;
}
