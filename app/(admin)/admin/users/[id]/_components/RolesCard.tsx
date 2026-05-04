"use client";

import { useActionState } from "react";

import { grantRole } from "../actions";
import {
  ASSIGNABLE_ROLES,
  CHM_NOTE,
  ROLE_LABELS,
} from "@/lib/auth/roles";

export function RolesCard({
  targetUserId,
  actorUserId,
}: {
  targetUserId: string;
  actorUserId: string;
}) {
  const [state, action, pending] = useActionState(grantRole, {});
  const isSelf = targetUserId === actorUserId;

  return (
    <div>
      {isSelf && (
        <p className="muted-cell" style={{ marginBottom: 12 }}>
          You&rsquo;re viewing your own user — admin / super_admin self-grants
          will be blocked.
        </p>
      )}
      {state.error && (
        <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
          {state.error}
        </div>
      )}
      {state.success && (
        <div
          className="badge"
          role="status"
          style={{ display: "inline-block", marginBottom: 12 }}
        >
          {state.success}
        </div>
      )}
      <form
        action={action}
        style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 2fr auto" }}
      >
        <input type="hidden" name="target_user_id" value={targetUserId} />
        <select name="role" defaultValue="clinician" required>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <input
          name="reason"
          placeholder="Optional reason"
          maxLength={500}
        />
        <button type="submit" disabled={pending}>
          {pending ? "Granting…" : "Grant"}
        </button>
      </form>
      <p className="muted-cell" style={{ marginTop: 8, fontSize: "0.85em" }}>
        {CHM_NOTE}
      </p>
    </div>
  );
}
