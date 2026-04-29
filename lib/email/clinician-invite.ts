import { getFromAddress, getResend } from "./client";

type InviteArgs = {
  to: string;
  inviteUrl: string;
  inviterName: string;
  role: "clinician" | "coach";
  fullName?: string | null;
};

/**
 * Branded clinician/coach invite email. Sent via Resend in place of the
 * default Supabase invite template so the wording, branding, and CTA copy
 * are consistent with the rest of the platform.
 */
export async function sendClinicianInviteEmail({
  to,
  inviteUrl,
  inviterName,
  role,
  fullName,
}: InviteArgs) {
  const resend = getResend();
  const greeting = fullName ? `Hi ${fullName},` : "Hi there,";
  const roleLabel = role === "clinician" ? "clinician" : "coach";
  const ctaLabel = role === "clinician" ? "Open the clinician portal" : "Open the coach portal";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px;color:#2B2B2B;">
        You&rsquo;ve been invited to Longevity Coach
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        ${inviterName} has invited you to join Longevity Coach as a <strong>${roleLabel}</strong>.
        Click below to set your password and access the portal.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          ${ctaLabel}
        </a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#4B4B4B;margin:0 0 8px;">
        This invitation expires in 14 days. If the button above doesn&rsquo;t work,
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
      Longevity Coach · ${new Date().getFullYear()}
    </p>
  </body>
</html>`;

  const text = `${greeting}

${inviterName} has invited you to join Longevity Coach as a ${roleLabel}.

Set your password and access the portal: ${inviteUrl}

This invitation expires in 14 days.

Questions? Just reply to this email.

- The Longevity Coach team`;

  return resend.emails.send({
    from: getFromAddress(),
    to,
    subject: `You've been invited to Longevity Coach as a ${roleLabel}`,
    html,
    text,
  });
}

type PromotedArgs = {
  to: string;
  inviterName: string;
  role: "clinician" | "coach";
  fullName?: string | null;
  appUrl: string;
};

/**
 * Sent when an existing user is promoted to clinician/coach. They already have
 * an account so no invite link is needed — just a welcome-to-the-portal email.
 */
export async function sendClinicianPromotedEmail({
  to,
  inviterName,
  role,
  fullName,
  appUrl,
}: PromotedArgs) {
  const resend = getResend();
  const greeting = fullName ? `Hi ${fullName},` : "Hi there,";
  const roleLabel = role === "clinician" ? "clinician" : "coach";
  const portalUrl = `${appUrl}/clinician`;
  const ctaLabel = role === "clinician" ? "Open the clinician portal" : "Open the coach portal";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px;color:#2B2B2B;">
        You&rsquo;ve been added as a ${roleLabel}
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        ${inviterName} has granted you ${roleLabel} access on Longevity Coach.
        Sign in with your existing account to open the portal.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${portalUrl}"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          ${ctaLabel}
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

${inviterName} has granted you ${roleLabel} access on Longevity Coach. Sign in with your existing account to open the portal.

${portalUrl}

- The Longevity Coach team`;

  return resend.emails.send({
    from: getFromAddress(),
    to,
    subject: `You're now a ${roleLabel} on Longevity Coach`,
    html,
    text,
  });
}
