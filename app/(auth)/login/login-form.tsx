"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "../actions";
import { PasswordInput } from "../_components/password-input";

export function LoginForm() {
  const params = useSearchParams();
  const callbackError = params.get("error") === "auth_callback_failed"
    ? "We couldn't complete that link. Try signing in again."
    : null;
  const redirectParam = params.get("redirect") ?? "";

  const [state, action, pending] = useActionState(signIn, {});

  const error = state.error ?? callbackError;

  return (
    <form action={action}>
      {error && <div className="auth-error">{error}</div>}
      <input type="hidden" name="redirect" value={redirectParam} />
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
        />
      </label>
      <label>
        Password
        <PasswordInput name="password" autoComplete="current-password" required />
      </label>
      <a href="/forgot-password" className="auth-forgot">Forgot password?</a>
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
