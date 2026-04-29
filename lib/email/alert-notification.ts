import { getFromAddress, getResend } from "./client";

type AlertEmailArgs = {
  to: string;
  firstName?: string | null;
  appUrl: string;
  title: string;
  body: string;
  linkHref: string | null;
  severity: "info" | "attention" | "urgent";
};

const SEVERITY_COLOUR: Record<AlertEmailArgs["severity"], string> = {
  info: "#2F6F8F",
  attention: "#B45309",
  urgent: "#B91C1C",
};

export async function sendAlertNotificationEmail(args: AlertEmailArgs): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const greeting = args.firstName ? `Hi ${args.firstName},` : "Hello,";
  const heading = SEVERITY_COLOUR[args.severity];
  const ctaHref = args.linkHref ? `${args.appUrl}${args.linkHref}` : `${args.appUrl}/dashboard`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 16px;color:${heading};">
        ${args.title}
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;white-space:pre-wrap;">${escapeHtml(args.body)}</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${ctaHref}"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Open my dashboard
        </a>
      </p>
      <p style="font-size:12px;line-height:1.55;color:#8A9AA5;margin:24px 0 0;">
        Don't want these? <a href="${args.appUrl}/account" style="color:#8A9AA5;">Turn off health-alert emails.</a>
      </p>
    </div>
  </body>
</html>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: getFromAddress(),
      to: args.to,
      subject: args.title,
      html,
    });
  } catch (err) {
    console.warn("[alert-notification email] send failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
