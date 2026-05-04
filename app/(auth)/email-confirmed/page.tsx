import { safeRedirect } from "@/lib/auth/safe-redirect";

export const metadata = { title: "Email confirmed · Janet" };

export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const continueUrl = safeRedirect(next);

  return (
    <>
      <h1>Your email is confirmed</h1>
      <p className="subtitle">
        Thanks — your account is active. The next step is a short health
        assessment so we can build your personalised plan. About 10 minutes.
      </p>
      <p style={{ marginTop: 8 }}>
        <a href={continueUrl} className="auth-cta">
          Continue
        </a>
      </p>
    </>
  );
}
