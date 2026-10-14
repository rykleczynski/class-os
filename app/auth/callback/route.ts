import { NextResponse, type NextRequest } from "next/server";
import { isOwnerEmail } from "@/lib/owner";
import { getAuthClient } from "@/lib/supabase/server";

/** Magic-link landing: trade the code for a cookie session, then keep it only for the owner. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  const auth = await getAuthClient();
  if (!auth || !code) return to("/sign-in?error=link");
  const { data, error } = await auth.auth.exchangeCodeForSession(code);
  if (error || !data.user) return to("/sign-in?error=link");
  if (!isOwnerEmail(data.user.email)) {
    await auth.auth.signOut();
    return to("/sign-in?error=link");
  }
  return to("/");
}
