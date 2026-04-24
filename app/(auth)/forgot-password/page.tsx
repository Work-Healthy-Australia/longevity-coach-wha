import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset password · Longevity Coach" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1>Reset your password</h1>
      <p className="subtitle">
        Enter your email and we&apos;ll send a link to reset your password.
      </p>
      <ForgotPasswordForm />
      <p className="auth-meta">
        Remembered it? <a href="/login">Back to sign in</a>
      </p>
    </>
  );
}
