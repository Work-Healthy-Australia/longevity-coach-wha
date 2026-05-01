"use client";

import { useActionState, useState } from "react";

import { type IdentityState } from "../identity-schema";
import { updateIdentity } from "../identity-actions";

type Initial = {
  full_name: string;
  email: string;
  date_of_birth: string;
  phone: string;
  address_postal: string;
};

function formatDob(iso: string): string {
  if (!iso) return "Not provided";
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

  const v = state.values ?? initial;
  const displayName = (v.full_name || initial.full_name).trim();
  const displayDob = v.date_of_birth ?? initial.date_of_birth;
  const displayPhone = v.phone ?? initial.phone;
  const displayAddress = v.address_postal ?? initial.address_postal;

  if (!editing) {
    return (
      <section className="lc-account-card">
        <div className="lc-account-card-header">
          <div className="lc-account-card-headline">
            <span className="lc-account-card-eyebrow">Identity</span>
            <h2>Your details</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        </div>

        <p
          className={
            displayName
              ? "lc-account-letterhead"
              : "lc-account-letterhead placeholder"
          }
        >
          {displayName || "Add your name"}
        </p>

        <dl className="lc-account-id">
          <div>
            <dt>Email</dt>
            <dd>{initial.email || "—"}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd className={displayDob ? "" : "muted"}>{formatDob(displayDob)}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className={displayPhone ? "" : "muted"}>
              {displayPhone || "Not provided"}
            </dd>
          </div>
          <div>
            <dt>Postal address</dt>
            <dd className={displayAddress ? "" : "muted"}>
              {displayAddress || "Not provided"}
            </dd>
          </div>
        </dl>

        <p className="lc-account-meta">
          Email is managed in the Security card below.
        </p>
      </section>
    );
  }

  return (
    <section className="lc-account-card">
      <div className="lc-account-card-header">
        <div className="lc-account-card-headline">
          <span className="lc-account-card-eyebrow">Identity</span>
          <h2>Edit your details</h2>
        </div>
      </div>

      {state.error && <div className="lc-account-error">{state.error}</div>}
      {state.success && <div className="lc-account-success">{state.success}</div>}

      <form action={formAction} className="lc-account-form">
        <label className="lc-account-field">
          <span>Full name</span>
          <input
            type="text"
            name="full_name"
            defaultValue={v.full_name ?? initial.full_name}
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
            autoComplete="name"
          />
        </label>

        <div className="lc-account-form-row">
          <label className="lc-account-field">
            <span>Date of birth</span>
            <input
              type="date"
              name="date_of_birth"
              defaultValue={v.date_of_birth ?? initial.date_of_birth}
              disabled={pending}
              autoComplete="bday"
            />
          </label>

          <label className="lc-account-field">
            <span>Phone</span>
            <input
              type="tel"
              name="phone"
              defaultValue={v.phone ?? initial.phone}
              maxLength={30}
              placeholder="Optional"
              disabled={pending}
              autoComplete="tel"
            />
          </label>
        </div>

        <label className="lc-account-field">
          <span>Postal address</span>
          <input
            type="text"
            name="address_postal"
            defaultValue={v.address_postal ?? initial.address_postal}
            maxLength={200}
            placeholder="Optional"
            disabled={pending}
            autoComplete="street-address"
          />
        </label>

        <div className="lc-account-form-actions">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
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
