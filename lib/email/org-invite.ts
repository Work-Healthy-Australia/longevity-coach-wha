import { getFromAddress, getResend } from "./client";

type OrgInviteArgs = {
  to: string;
  name: string;
  orgName: string;
  inviterName: string;
  token: string;
};

/**
 * Branded organisation invite email. Sent when a health_manager bulk-invites
 * members via CSV upload. Links to /signup with the invite token so the
 * signup flow can auto-associate the new user with the organisation.
 *
 * Silently no-ops if Resend is not configured (preview environments).
 */
export async function sendOrgInviteEmail({
  to,
  name,
  orgName,
  inviterName,
  token,
}: OrgInviteArgs) {
  let resend: ReturnType<typeof getResend>;
  try {
    resend = getResend();
  } catch {
    // Resend not configured — silently no-op
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://janet.care";
  const inviteUrl = `${siteUrl}/signup?invite_token=${token}`;
  const greeting = name ? `Hi ${name},` : "Hi there,";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px;color:#2B2B2B;">
        You&rsquo;ve been invited to join ${orgName}
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        ${inviterName} has invited you to join <strong>${orgName}</strong> on Longevity Coach.
        Click below to create your account and get started.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Accept invitation
        </a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#4B4B4B;margin:0 0 8px;">
        This invitation expires in 7 days. If the button above doesn&rsquo;t work,
        copy this link into your browser:
      </p>
      <p style="font-size:13px;line-height:1.55;color:#2F6F8F;margin:0 0 24px;word-break:break-all;">
        ${inviteUrl}
      </p>
      <p style="font-size:13px;line-height:1.55;color:#8A9AA5;margin:24px 0 0;">
        Questions? Just reply to this email.
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#8A9AA5;margin:8px 0 24px;">
      Longevity Coach &middot; ${new Date().getFullYear()}
    </p>
  </body>
</html>`;

  const text = `${greeting}

${inviterName} has invited you to join ${orgName} on Longevity Coach.

Create your account and get started: ${inviteUrl}

This invitation expires in 7 days.

Questions? Just reply to this email.

- The Longevity Coach team`;

  return resend.emails.send({
    from: getFromAddress(),
    to,
    subject: `You've been invited to join ${orgName} on Longevity Coach`,
    html,
    text,
  });
}
