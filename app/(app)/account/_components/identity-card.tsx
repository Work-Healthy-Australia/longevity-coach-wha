"use client";

import { useActionState, useState } from "react";

import { updateIdentity, type IdentityState } from "../identity-actions";

type Initial = {
  full_name: string;
  email: string;
  date_of_birth: string;
  phone: string;
  address_postal: string;
};

function formatDob(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

const initialState: IdentityState = {};

export function IdentityCard({ initial }: { initial: Initial }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateIdentity, initialState);

  const values = state.values ?? initial;
  const displayName = values.full_name || initial.full_name;
  const displayDob = values.date_of_birth ?? initial.date_of_birth;
  const displayPhone = values.phone ?? initial.phone;
  const displayAddress = values.address_postal ?? initial.address_postal;

  if (!editing) {
    return (
      <section className="lc-account-card">
        <div className="lc-account-card-header">
          <h2>Identity</h2>
          <button
            type="button"
            className="lc-account-button-secondary"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        </div>
        <dl className="lc-account-id">
          <div>
            <dt>Name</dt>
            <dd>{displayName || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{initial.email || "—"}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{formatDob(displayDob)}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{displayPhone || "Not provided"}</dd>
          </div>
          <div>
            <dt>Postal address</dt>
            <dd>{displayAddress || "Not provided"}</dd>
          </div>
        </dl>
        <p className="lc-account-meta">
          Email is managed in the Security section below.
        </p>
      </section>
    );
  }

  return (
    <section className="lc-account-card">
      <div className="lc-account-card-header">
        <h2>Edit identity</h2>
      </div>

      {state.error && <div className="lc-account-error">{state.error}</div>}
      {state.success && <div className="lc-account-success">{state.success}</div>}

      <form action={formAction} className="lc-account-form">
        <label className="lc-account-field">
          <span>Full name</span>
          <input
            type="text"
            name="full_name"
            defaultValue={values.full_name ?? initial.full_name}
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
          />
        </label>

        <label className="lc-account-field">
          <span>Date of birth</span>
          <input
            type="date"
            name="date_of_birth"
            defaultValue={values.date_of_birth ?? initial.date_of_birth}
            disabled={pending}
          />
        </label>

        <label className="lc-account-field">
          <span>Phone</span>
          <input
            type="tel"
            name="phone"
            defaultValue={values.phone ?? initial.phone}
            maxLength={30}
            placeholder="Optional"
            disabled={pending}
          />
        </label>

        <label className="lc-account-field">
          <span>Postal address</span>
          <input
            type="text"
            name="address_postal"
            defaultValue={values.address_postal ?? initial.address_postal}
            maxLength={200}
            placeholder="Optional"
            disabled={pending}
          />
        </label>

        <div className="lc-account-form-actions">
          <button type="submit" className="lc-account-button" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className="lc-account-button-secondary"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            {state.success ? "Done" : "Cancel"}
          </button>
        </div>
      </form>
    </section>
  );
}
