"use client";

import { useActionState } from "react";
import { inviteAdmin, revokeAdmin } from "../actions";

type Admin = { id: string; full_name: string | null };
type Invite = { email: string; invited_at: string };

export function AdminAdminsUI({
  admins,
  pendingInvites,
}: {
  admins: Admin[];
  pendingInvites: Invite[];
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteAdmin, null);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeAdmin, null);

  return (
    <div className="admin-content">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Admin access</h1>

      {/* Current admins */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2 className="admin-card-title">Current admins</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>
                  <span className="user-name">{a.full_name ?? "—"}</span>
                </td>
                <td>
                  <form action={revokeAction}>
                    <input type="hidden" name="userId" value={a.id} />
                    <button
                      type="submit"
                      disabled={revokePending}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#B03030",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      Revoke
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={2} className="empty-row">No admins found.</td>
              </tr>
            )}
          </tbody>
        </table>
        {revokeState && "error" in revokeState && (
          <p style={{ color: "#B03030", fontSize: 13, marginTop: 8 }}>{revokeState.error}</p>
        )}
        {revokeState && "success" in revokeState && (
          <p style={{ color: "#1A7A3C", fontSize: 13, marginTop: 8 }}>{revokeState.success}</p>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h2 className="admin-card-title">Pending invites</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Invited</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((i) => (
                <tr key={i.email}>
                  <td>{i.email}</td>
                  <td style={{ fontSize: 12, color: "#7A90A0" }}>
                    {new Date(i.invited_at).toLocaleDateString("en-AU", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite form */}
      <div className="admin-card">
        <h2 className="admin-card-title">Invite a new admin</h2>
        <p style={{ fontSize: 14, color: "#4A6070", marginBottom: 16 }}>
          Existing accounts get access immediately. New users receive an invite email and get admin
          access when they sign up.
        </p>
        <form action={inviteAction} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <input
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #D0DAE4",
              borderRadius: 6,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={invitePending}
            style={{
              padding: "8px 20px",
              background: "#1A3A4A",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              opacity: invitePending ? 0.6 : 1,
            }}
          >
            {invitePending ? "Sending…" : "Invite"}
          </button>
        </form>
        {inviteState && "error" in inviteState && (
          <p style={{ color: "#B03030", fontSize: 13, marginTop: 10 }}>{inviteState.error}</p>
        )}
        {inviteState && "success" in inviteState && (
          <p style={{ color: "#1A7A3C", fontSize: 13, marginTop: 10 }}>{inviteState.success}</p>
        )}
      </div>
    </div>
  );
}
