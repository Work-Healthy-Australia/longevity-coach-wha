import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin", "/uploads", "/check-in", "/report", "/account", "/labs", "/trends", "/simulator"];
const PAUSE_REDIRECTED_PREFIXES = ["/dashboard", "/report", "/check-in", "/trends", "/labs", "/uploads", "/journal", "/insights"];
const AUTH_ONLY_PREFIXES = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Supabase not configured yet - pass through. Lets us deploy
  // marketing previews without requiring auth env vars.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() refreshes the session cookie if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && matches(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (user && matches(pathname, AUTH_ONLY_PREFIXES)) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    dash.search = "";
    return NextResponse.redirect(dash);
  }

  // Paused account check — fail open on DB error to avoid permanent lockout.
  if (user && matches(pathname, PAUSE_REDIRECTED_PREFIXES)) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("paused_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.paused_at && !pathname.startsWith("/account")) {
        return NextResponse.redirect(new URL("/account?paused=true", request.url));
      }
    } catch {
      // Fail open — allow through if DB query fails.
    }
  }

  return response;
}
