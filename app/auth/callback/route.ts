import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/welcome";

const JUST_CONFIRMED_WINDOW_MS = 60_000;

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
  const next = url.searchParams.get("next") ?? "/dashboard";

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

  return NextResponse.redirect(new URL(next, url));
}
