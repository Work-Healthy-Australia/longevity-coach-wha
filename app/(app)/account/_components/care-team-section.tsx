"use client";

import { useActionState } from "react";

import { nominateClinician, revokeClinician } from "../care-team-actions";

export type AssignedClinician = {
  assignment_id: string;
  full_name: string | null;
  contact_email: string | null;
  specialties: string[];
  assigned_at: string;
};

export function CareTeamSection({ clinicians }: { clinicians: AssignedClinician[] }) {
  const [nomState, nomAction, nomPending] = useActionState(nominateClinician, null);
  const [revState, revAction, revPending] = useActionState(revokeClinician, null);

  const error = nomState?.error ?? revState?.error;
  const success = nomState?.success ?? revState?.success;

  return (
    <section className="lc-account-card">
      <h2>Care team access</h2>
      <p className="lc-account-info">
        Nominate a registered clinician by email. They can then read your check-ins,
        risk scores, and lab results so they can advise you. You can revoke access
        at any time. Each nomination and revocation is logged for AHPRA audit.
      </p>

      {error && <div className="lc-account-error">{error}</div>}
      {success && <div className="lc-account-success">{success}</div>}

      {clinicians.length > 0 && (
        <ul className="lc-care-team-list">
          {clinicians.map((c) => (
            <li key={c.assignment_id}>
              <div>
                <strong>{c.full_name ?? c.contact_email ?? "Clinician"}</strong>
                {c.specialties.length > 0 && (
                  <span className="lc-account-muted"> — {c.specialties.join(", ")}</span>
                )}
                <div className="lc-account-muted" suppressHydrationWarning>
                  Granted {new Date(c.assigned_at).toLocaleDateString()}
                </div>
              </div>
              <form action={revAction}>
                <input type="hidden" name="assignmentId" value={c.assignment_id} />
                <button type="submit" className="lc-account-button-secondary" disabled={revPending}>
                  {revPending ? "Revoking…" : "Revoke"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={nomAction} className="lc-care-team-form">
        <label>
          Clinician email
          <input type="email" name="email" required placeholder="clinician@example.com" />
        </label>
        <button type="submit" className="lc-account-button" disabled={nomPending}>
          {nomPending ? "Adding…" : "Grant access"}
        </button>
      </form>
    </section>
  );
}
