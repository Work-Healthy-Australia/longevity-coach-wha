import { getFromAddress, getResend } from "./client";

type Args = {
  to: string;
  fullName: string | null;
  clinicianName: string | null;
  program: string;
  appUrl: string;
};

/**
 * Sent when a clinician clicks "Approve & send to patient" on a 30-day program.
 * The program body is rendered as `<pre>` so markdown structure stays readable
 * without requiring a markdown-to-html step on the server.
 */
export async function sendProgramDeliveryEmail({
  to,
  fullName,
  clinicianName,
  program,
  appUrl,
}: Args) {
  const resend = getResend();
  const greeting = fullName ? `Hi ${fullName},` : "Hi there,";
  const fromClinician = clinicianName ? `${clinicianName}` : "Your clinician";
  const dashboardUrl = `${appUrl}/dashboard`;

  // Inline-style escapes that matter inside HTML preformatted content.
  const escaped = program
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:640px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px;color:#2B2B2B;">
        Your 30-day program
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        ${fromClinician} has approved your 30-day program based on this month&rsquo;s check-in.
        Reply to this email if anything is unclear.
      </p>
      <pre style="white-space:pre-wrap;word-wrap:break-word;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.55;background:#F4F7F9;border:1px solid #E3E8EC;border-radius:8px;padding:16px;color:#2B2B2B;">${escaped}</pre>
      <p style="margin:32px 0;text-align:center;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Open my dashboard
        </a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#8A9AA5;margin:24px 0 0;">
        Questions? Just reply to this email.
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#8A9AA5;margin:8px 0 24px;">
      Longevity Coach · ${new Date().getFullYear()}
    </p>
  </body>
</html>`;

  const text = `${greeting}

${fromClinician} has approved your 30-day program based on this month's check-in.

${program}

Open your dashboard: ${dashboardUrl}

Reply to this email if anything is unclear.

- The Longevity Coach team`;

  return resend.emails.send({
    from: getFromAddress(),
    to,
    subject: "Your 30-day program is ready",
    html,
    text,
  });
}
