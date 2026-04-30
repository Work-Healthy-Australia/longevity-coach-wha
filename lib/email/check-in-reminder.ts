import { getFromAddress, getResend } from "./client";

type CheckInReminderArgs = {
  to: string;
  firstName?: string | null;
  appUrl: string;
};

export async function sendCheckInReminderEmail(args: CheckInReminderArgs): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const { to, firstName, appUrl } = args;
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 16px;color:#2B2B2B;">
        Two minutes for today's check-in?
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        A quick log of how you slept, moved, and felt today is what makes the trend lines on your dashboard meaningful. Two minutes is enough.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${appUrl}/check-in"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Log today
        </a>
      </p>
      <p style="font-size:12px;line-height:1.55;color:#8A9AA5;margin:24px 0 0;">
        Don't want these? <a href="${appUrl}/account" style="color:#8A9AA5;">Turn off check-in reminders.</a>
      </p>
    </div>
  </body>
</html>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: "Two minutes for today's check-in?",
      html,
    });
  } catch (err) {
    console.warn("[check-in-reminder email] send failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}
