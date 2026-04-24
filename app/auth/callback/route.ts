import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/welcome";

const JUST_CONFIRMED_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
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
