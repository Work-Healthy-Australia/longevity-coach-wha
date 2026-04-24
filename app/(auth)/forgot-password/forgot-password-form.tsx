"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  return (
    <form action={action}>
      {state.error && <div className="auth-error">{state.error}</div>}
      {state.success && <div className="auth-success">{state.success}</div>}
      <label>
        Email
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
