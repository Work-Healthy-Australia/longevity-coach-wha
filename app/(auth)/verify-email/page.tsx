export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <>
      <h1>Check your inbox</h1>
      <p className="subtitle">
        We sent a verification link to{" "}
        <strong>{email ?? "your email address"}</strong>. Click it to activate
        your account.
      </p>
      <p className="auth-meta">
        Wrong email? <a href="/signup">Sign up again</a>
      </p>
    </>
  );
}
