import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { sendWelcomeEmail } from "@/lib/email/welcome";

const JUST_CONFIRMED_WINDOW_MS = 60_000;
const RECOVERY_LANDING = "/reset-password";

// Handles two Supabase auth callbacks against the same URL:
//
//   1. Email confirmation / password reset / magic link via verifyOtp.
//      Supabase email templates send users to ?token_hash=...&type=signup
//      (or recovery, email, invite, magiclink, email_change).
//
//   2. OAuth / PKCE-style code exchange via exchangeCodeForSession.
//      Used by social sign-in and PKCE magic-link flows that pass ?code=.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next");

  // Recovery flows MUST land on /reset-password — never honour an
  // attacker-supplied next here. safeRedirect's auth-loop block-list also
  // rejects /reset-password, so we bypass it for this single type.
  let next: string;
  if (type === "recovery") {
    if (rawNext !== null && rawNext !== RECOVERY_LANDING) {
      console.warn("auth callback: recovery flow with unexpected next, forcing /reset-password");
    }
    next = RECOVERY_LANDING;
  } else {
    next = safeRedirect(rawNext);
  }

  const supabase = await createClient();

  let authError: string | null = null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) authError = error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) authError = error.message;
  } else {
    authError = "missing token_hash or code";
  }

  if (authError) {
    console.error("auth callback failed:", authError);
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url));
  }

  // Fire welcome email on first confirmation only. We approximate "first
  // confirmation" with a tight time window after email_confirmed_at, which
  // avoids re-sending if a user re-clicks the link later. Idempotent
  // tracking can move into a profiles column once we touch that table.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email && user.email_confirmed_at) {
    const confirmedAt = new Date(user.email_confirmed_at).getTime();
    const justConfirmed = Date.now() - confirmedAt < JUST_CONFIRMED_WINDOW_MS;
    if (justConfirmed && process.env.RESEND_API_KEY) {
      try {
        const firstName =
          (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;
        await sendWelcomeEmail({
          to: user.email,
          firstName,
          appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? url.origin,
        });
      } catch (err) {
        console.error("Welcome email failed", err);
      }
    }
  }

  // After signup email confirmation, route through a thank-you page rather
  // than dropping the user straight onto the dashboard — softer landing,
  // clearer signal that the click worked.
  if (type === "signup") {
    const confirmedUrl = new URL("/email-confirmed", url);
    confirmedUrl.searchParams.set("next", next);
    return NextResponse.redirect(confirmedUrl);
  }

  return NextResponse.redirect(new URL(next, url));
}
