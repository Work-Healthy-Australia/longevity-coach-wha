"use client";

import { useActionState } from "react";

import { revokeRoleAssignment } from "../actions";

export function RevokeRoleButton({
  assignmentId,
  targetUserId,
  roleLabel,
}: {
  assignmentId: string;
  targetUserId: string;
  roleLabel: string;
}) {
  const [state, action, pending] = useActionState(revokeRoleAssignment, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Revoke ${roleLabel}?`)) {
          e.preventDefault();
        }
      }}
      style={{ display: "inline-block" }}
    >
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <button
        type="submit"
        disabled={pending}
        className="btn-link"
        style={{
          background: "none",
          border: "none",
          color: "#C0392B",
          cursor: "pointer",
          padding: 0,
          font: "inherit",
        }}
        title={state.error ?? undefined}
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {state.error && (
        <span style={{ color: "#C0392B", marginLeft: 8, fontSize: "0.85em" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}
