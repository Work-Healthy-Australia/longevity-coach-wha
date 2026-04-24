import { getFromAddress, getResend } from "./client";

type WelcomeArgs = {
  to: string;
  firstName?: string | null;
  appUrl: string;
};

export async function sendWelcomeEmail({ to, firstName, appUrl }: WelcomeArgs) {
  const resend = getResend();
  const greeting = firstName ? `Hi ${firstName},` : "Welcome,";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px;color:#2B2B2B;">
        Welcome to Longevity Coach
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        Your account is ready. The next step is a short health assessment -
        about 10 minutes. We'll use it to calculate your biological age, your
        risk scores across five domains, and a personalised supplement protocol.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${appUrl}/onboarding"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Start your assessment
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

Your Longevity Coach account is ready. The next step is a short health assessment - about 10 minutes. We'll use it to calculate your biological age, your risk scores across five domains, and a personalised supplement protocol.

Start your assessment: ${appUrl}/onboarding

Questions? Just reply to this email.

- The Longevity Coach team`;

  return resend.emails.send({
    from: getFromAddress(),
    to,
    subject: "Welcome to Longevity Coach - let's get started",
    html,
    text,
  });
}
