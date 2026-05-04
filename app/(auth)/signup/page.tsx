import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import { authLinkWithRedirect } from "@/lib/auth/safe-redirect";

export const metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const loginHref = authLinkWithRedirect("/login", redirect);

  return (
    <>
      <h1>Create your account</h1>
      <p className="subtitle">Start with a free baseline assessment.</p>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
      <p className="auth-meta">
        Already have an account? <a href={loginHref}>Sign in</a>
      </p>
    </>
  );
}
