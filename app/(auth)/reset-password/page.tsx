import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Set a new password · Longevity Coach" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1>Set a new password</h1>
      <p className="subtitle">Choose a strong password (at least 8 characters).</p>
      <ResetPasswordForm />
    </>
  );
}
