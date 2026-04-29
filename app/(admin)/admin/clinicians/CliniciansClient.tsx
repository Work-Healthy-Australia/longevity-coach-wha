"use client";

import { useActionState } from "react";

import { inviteClinician, revokeClinician } from "./actions";

export type ClinicianRow = {
  id: string;
  full_name: string;
  role: string;
  contact_email: string | null;
  specialties: string[];
  is_active: boolean;
};

export type InviteRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export function CliniciansClient({
  initialRows,
  invites,
}: {
  initialRows: ClinicianRow[];
  invites: InviteRow[];
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteClinician, null);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeClinician, null);

  const error = inviteState?.error ?? revokeState?.error;
  const success = inviteState?.success ?? revokeState?.success;

  return (
    <div className="admin-clinicians">
      {error && <div className="crud-error">{error}</div>}
      {success && <div className="crud-success">{success}</div>}

      <section className="admin-card">
        <h2>Invite</h2>
        <form action={inviteAction} className="invite-form">
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Full name (optional)
            <input name="full_name" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="clinician">
              <option value="clinician">Clinician</option>
              <option value="coach">Coach</option>
            </select>
          </label>
          <button type="submit" disabled={invitePending}>
            {invitePending ? "Sending…" : "Send invite"}
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Active clinicians and coaches</h2>
        {initialRows.length === 0 ? (
          <div className="muted">No clinicians yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Specialties</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initialRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{r.contact_email ?? "—"}</td>
                  <td>{r.role}</td>
                  <td>{r.specialties.join(", ") || "—"}</td>
                  <td>{r.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <form action={revokeAction}>
                      <input type="hidden" name="userId" value={r.id} />
                      <button type="submit" disabled={revokePending}>
                        {revokePending ? "…" : "Revoke"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2>Pending invites</h2>
        {invites.length === 0 ? (
          <div className="muted">No pending invites.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td>{i.full_name ?? "—"}</td>
                  <td>{i.role}</td>
                  <td>{i.status}</td>
                  <td suppressHydrationWarning>{new Date(i.expires_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
