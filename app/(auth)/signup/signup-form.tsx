"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signUp } from "../actions";
import { PasswordInput } from "../_components/password-input";

export function SignupForm() {
  const params = useSearchParams();
  const redirectParam = params.get("redirect") ?? "";

  const [state, action, pending] = useActionState(signUp, {});

  return (
    <form action={action}>
      {state.error && <div className="auth-error">{state.error}</div>}
      <input type="hidden" name="redirect" value={redirectParam} />
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
