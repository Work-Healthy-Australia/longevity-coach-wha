import { authLinkWithRedirect } from "@/lib/auth/safe-redirect";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirect?: string }>;
}) {
  const { email, redirect } = await searchParams;
  const signupHref = authLinkWithRedirect("/signup", redirect);

  return (
    <>
      <h1>Check your inbox</h1>
      <p className="subtitle">
        We sent a verification link to{" "}
        <strong>{email ?? "your email address"}</strong>. Click it to activate
        your account.
      </p>
      <p className="auth-meta">
        Wrong email? <a href={signupHref}>Sign up again</a>
      </p>
    </>
  );
}
