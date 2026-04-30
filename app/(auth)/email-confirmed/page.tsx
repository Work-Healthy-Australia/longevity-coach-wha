export const metadata = { title: "Email confirmed · Janet" };

const ALLOWED_NEXT = ["/dashboard", "/onboarding", "/account", "/report"];

function safeNext(next: string | undefined): string {
  if (!next) return "/dashboard";
  return ALLOWED_NEXT.includes(next) ? next : "/dashboard";
}

export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const continueUrl = safeNext(next);

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
