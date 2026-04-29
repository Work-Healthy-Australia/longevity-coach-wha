import { getFromAddress, getResend } from "./client";

type CostAlertArgs = {
  to: string;
  periodDate: string;
  costUsdCents: number;
  thresholdUsdCents: number;
  appUrl: string;
};

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export async function sendCostAlertEmail(args: CostAlertArgs): Promise<void> {
  // Silently no-op if Resend isn't configured (preview/dev).
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const { to, periodDate, costUsdCents, thresholdUsdCents, appUrl } = args;
  const overage = costUsdCents - thresholdUsdCents;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 16px;color:#B45309;">
        Anthropic spend over budget
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px;color:#4B4B4B;">
        On <strong>${periodDate}</strong> Claude API usage totalled <strong>${fmtUsd(costUsdCents)}</strong>, exceeding the configured daily budget of <strong>${fmtUsd(thresholdUsdCents)}</strong> by <strong>${fmtUsd(overage)}</strong>.
      </p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${appUrl}/admin/cost"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Open cost dashboard
        </a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#8A9AA5;margin:0;">
        Per-agent breakdown and recent failures are on the dashboard. Acknowledge the alert there once you've reviewed.
      </p>
    </div>
  </body>
</html>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `Anthropic spend ${fmtUsd(costUsdCents)} on ${periodDate} (over ${fmtUsd(thresholdUsdCents)})`,
      html,
    });
  } catch (err) {
    console.warn("[cost-alert email] send failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}
