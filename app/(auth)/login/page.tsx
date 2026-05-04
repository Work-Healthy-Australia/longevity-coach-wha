import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { authLinkWithRedirect } from "@/lib/auth/safe-redirect";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const signupHref = authLinkWithRedirect("/signup", redirect);

  return (
    <>
      <h1>Welcome back</h1>
      <p className="subtitle">Sign in to continue your longevity journey.</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="auth-meta">
        Don&apos;t have an account? <a href={signupHref}>Create one</a>
      </p>
    </>
  );
}
