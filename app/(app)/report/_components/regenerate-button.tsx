"use client";

import { useActionState } from "react";
import { regenerateReport } from "../actions";

export function RegenerateButton() {
  const [state, action, pending] = useActionState(regenerateReport, null);

  return (
    <form action={action} className="regenerate-form">
      <button type="submit" disabled={pending} className="btn-regenerate">
        {pending ? "Generating…" : "Regenerate report"}
      </button>
      {state?.error && <p className="regen-error">{state.error}</p>}
    </form>
  );
}
