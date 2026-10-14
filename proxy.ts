import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { devBypassAllowed } from "@/lib/owner";

/**
 * Session refresh and the first line of the owner gate. Runs for everything except the
 * public surfaces (/s guest links, /homework, sign-in and the auth callback) and static files.
 * Pages and data reads re-check the owner themselves (lib/auth.ts); this only keeps the
 * cookie fresh and bounces visitors without a session before anything renders.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const enabled = Boolean(url && key);
  if (!enabled) {
    if (devBypassAllowed({ NODE_ENV: process.env.NODE_ENV, supabaseEnabled: false })) return NextResponse.next();
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url!, key!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });
  // getClaims verifies the JWT and refreshes an expired session; do not run code between create and this call.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const redirect = NextResponse.redirect(new URL("/sign-in", request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!s/|homework/|sign-in|auth/|_next/static|_next/image|favicon.ico).*)"],
};
