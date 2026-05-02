import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1>Welcome back</h1>
      <p className="subtitle">Sign in to continue your longevity journey.</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="auth-meta">
        Don&apos;t have an account? <a href="/signup">Create one</a>
      </p>
    </>
  );
}
