"use client";

import { useActionState } from "react";
import { updatePassword } from "../actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});

  return (
    <form action={action}>
      {state.error && <div className="auth-error">{state.error}</div>}
      <label>
        New password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
