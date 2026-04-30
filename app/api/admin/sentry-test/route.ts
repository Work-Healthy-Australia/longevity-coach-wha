import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

class SentryDSNVerificationError extends Error {
  constructor(adminUserId: string) {
    super(
      `Sentry DSN verification probe — fired by admin ${adminUserId} at ${new Date().toISOString()}. This is a deliberate exception to confirm error monitoring is live; if this lands in the Sentry issues view the DSN is wired correctly.`
    );
    this.name = "SentryDSNVerificationError";
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          "NEXT_PUBLIC_SENTRY_DSN is not set in this environment. Sentry is intentionally dark — see docs/operations/sentry-setup.md to activate.",
      },
      { status: 200 }
    );
  }

  const eventId = Sentry.captureException(new SentryDSNVerificationError(auth.userId));

  await Sentry.flush(2000);

  return NextResponse.json({
    ok: true,
    configured: true,
    eventId,
    message:
      "Verification exception sent. Look for a 'SentryDSNVerificationError' in the Sentry issues view; it should appear within ~30s.",
    next: "Once confirmed, resolve or delete the issue in Sentry — it is a deliberate test, not a real bug.",
  });
}
