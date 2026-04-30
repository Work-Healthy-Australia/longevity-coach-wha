import { getFromAddress, getResend } from "./client";

type DripArgs = {
  to: string;
  firstName?: string | null;
  appUrl: string;
  day: 1 | 3 | 7;
};

const SUBJECTS: Record<number, string> = {
  1: "Your Janet Cares report is ready",
  3: "A quick check-in from Janet Cares",
  7: "Your first week with Janet Cares",
};

function buildHtml(firstName: string | null | undefined, appUrl: string, day: 1 | 3 | 7): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";

  const bodies: Record<number, string> = {
    1: `
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        Your biological age, risk scores, and personalised supplement protocol are ready.
        Janet, your health coach, is standing by to walk you through the results.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${appUrl}/report"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          View your report
        </a>
      </p>
      <p style="font-size:14px;line-height:1.55;margin:0 0 12px;color:#4B4B4B;">
        The report includes:
      </p>
      <ul style="font-size:14px;line-height:1.8;color:#4B4B4B;margin:0 0 16px;padding-left:20px;">
        <li>Your biological age vs chronological age</li>
        <li>Five-domain risk breakdown (cardiovascular, metabolic, neurological, oncological, musculoskeletal)</li>
        <li>A personalised supplement protocol — downloadable as a PDF</li>
        <li>Recommended screenings and lifestyle changes</li>
      </ul>`,
    3: `
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        It's been a few days since you joined Janet Cares. How are you tracking with your
        supplement protocol?
      </p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        If you haven't uploaded any blood test results yet, now is a great time.
        Janet can analyse your pathology and refine your supplement protocol with real biomarker data.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${appUrl}/uploads"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Upload blood test results
        </a>
      </p>`,
    7: `
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">${greeting}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        One week in. The research is consistent: the people who see results are the ones
        who make the supplement protocol a daily habit in week one.
      </p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#4B4B4B;">
        Ask Janet anything — whether it's why a supplement is recommended, how to fit it into your
        routine, or what your risk score actually means for your day-to-day life.
      </p>
      <p style="margin:32px 0;text-align:center;">
        <a href="${appUrl}/report"
           style="display:inline-block;background:#2F6F8F;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Talk to Janet
        </a>
      </p>`,
  };

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F7F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#2B2B2B;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #E3E8EC;border-radius:16px;padding:40px 32px;">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 20px;color:#1A3A4A;">
        ${SUBJECTS[day]}
      </h1>
      ${bodies[day]}
      <p style="font-size:13px;line-height:1.55;color:#8A9AA5;margin:24px 0 0;">
        Questions? Just reply to this email.
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#8A9AA5;margin:8px 0 24px;">
      Janet Cares · ${new Date().getFullYear()} ·
      <a href="${appUrl}/account" style="color:#8A9AA5;">Manage preferences</a>
    </p>
  </body>
</html>`;
}

export async function sendDripEmail({ to, firstName, appUrl, day }: DripArgs) {
  const resend = getResend();

  return resend.emails.send({
    from: getFromAddress(),
    to,
    subject: SUBJECTS[day],
    html: buildHtml(firstName, appUrl, day),
  });
}
