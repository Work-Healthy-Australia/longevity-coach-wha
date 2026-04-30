"use client";

import { useActionState } from "react";
import { signUp } from "../actions";
import { PasswordInput } from "../_components/password-input";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, {});

  return (
    <form action={action}>
      {state.error && <div className="auth-error">{state.error}</div>}
      <label>
        Full name
        <input
          type="text"
          name="full_name"
          autoComplete="name"
          required
          defaultValue={state.values?.full_name ?? ""}
        />
      </label>
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
        <PasswordInput
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
