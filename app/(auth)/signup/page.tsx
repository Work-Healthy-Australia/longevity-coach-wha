import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · Longevity Coach" };

export default function SignupPage() {
  return (
    <>
      <h1>Create your account</h1>
      <p className="subtitle">Start with a free baseline assessment.</p>
      <SignupForm />
      <p className="auth-meta">
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </>
  );
}
