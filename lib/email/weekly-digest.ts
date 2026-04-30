import { getFromAddress, getResend } from "./client";

type DigestArgs = {
  to: string;
  firstName?: string | null;
  appUrl: string;
  daysLogged: number;
  avgSleep: number | null;
  avgMood: number | null;
  avgEnergy: number | null;
  avgSteps: number | null;
  openAlerts: number;
};

const fmt = (v: number | null, dp = 1) => (v == null ? "—" : v.toFixed(dp));
const fmt0 = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString());

export async function sendWeeklyDigestEmail(args: DigestArgs): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const greeting = args.firstName ? `Hi ${args.firstName},` : "Hello,";
  const headline = args.daysLogged >= 5
    ? `Strong week — you logged ${args.daysLogged} of 7 days.`
    : args.daysLogged > 0
      ? `You logged ${args.daysLogged} of 7 days last week.`
      : "Last week was light on logs.";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 16px;color:#2B2B2B;">
        Your week in review
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${headline}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tbody>
          <tr><td style="padding:8px 0;font-size:14px;color:#6B7A82;">Avg sleep</td><td style="padding:8px 0;font-size:14px;text-align:right;color:#1F3A4D;">${fmt(args.avgSleep)} h</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#6B7A82;">Avg mood</td><td style="padding:8px 0;font-size:14px;text-align:right;color:#1F3A4D;">${fmt(args.avgMood)} / 10</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#6B7A82;">Avg energy</td><td style="padding:8px 0;font-size:14px;text-align:right;color:#1F3A4D;">${fmt(args.avgEnergy)} / 10</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:#6B7A82;">Avg daily steps</td><td style="padding:8px 0;font-size:14px;text-align:right;color:#1F3A4D;">${fmt0(args.avgSteps)}</td></tr>
        </tbody>
      </table>
      ${args.openAlerts > 0 ? `<p style="font-size:14px;line-height:1.55;margin:16px 0 0;color:#B45309;"><strong>${args.openAlerts}</strong> open ${args.openAlerts === 1 ? "alert" : "alerts"} on your dashboard.</p>` : ""}
      <p style="margin:32px 0;text-align:center;">
        <a href="${args.appUrl}/dashboard"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Open dashboard
        </a>
      </p>
      <p style="font-size:12px;line-height:1.55;color:#8A9AA5;margin:24px 0 0;">
        Don't want these? <a href="${args.appUrl}/account" style="color:#8A9AA5;">Turn off the weekly digest.</a>
      </p>
    </div>
  </body>
</html>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: getFromAddress(),
      to: args.to,
      subject: "Your week in review",
      html,
    });
  } catch (err) {
    console.warn("[weekly-digest email] send failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}
