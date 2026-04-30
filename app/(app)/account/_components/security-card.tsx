"use client";

import { useActionState } from "react";

import { signOut } from "@/app/(auth)/actions";

import {
  changeEmail,
  changePassword,
  type EmailState,
  type PasswordState,
} from "../security-actions";

const initialPassword: PasswordState = {};
const initialEmail: EmailState = {};

export function SecurityCard({ currentEmail }: { currentEmail: string }) {
  const [pwState, pwAction, pwPending] = useActionState(
    changePassword,
    initialPassword,
  );
  const [emState, emAction, emPending] = useActionState(
    changeEmail,
    initialEmail,
  );

  return (
    <section className="lc-account-card">
      <div className="lc-account-card-header">
        <h2>Security</h2>
      </div>

      <div className="lc-security-section">
        <h3 className="lc-security-section-heading">Password</h3>
        <p className="lc-account-info">
          Use at least 8 characters. Choose something you don&apos;t use elsewhere.
        </p>
        {pwState.error && <div className="lc-account-error">{pwState.error}</div>}
        {pwState.success && (
          <div className="lc-account-success">{pwState.success}</div>
        )}
        <form action={pwAction} className="lc-account-form">
          <label className="lc-account-field">
            <span>New password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pwPending}
            />
          </label>
          <label className="lc-account-field">
            <span>Confirm new password</span>
            <input
              type="password"
              name="confirm_password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pwPending}
            />
          </label>
          <div className="lc-account-form-actions">
            <button
              type="submit"
              className="lc-account-button"
              disabled={pwPending}
            >
              {pwPending ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>

      <div className="lc-security-divider" />

      <div className="lc-security-section">
        <h3 className="lc-security-section-heading">Email</h3>
        <p className="lc-account-info">
          Current: <strong>{currentEmail || "—"}</strong>. Changing your email
          sends a verification link to the new address. The change only takes
          effect once you click the link.
        </p>
        {emState.error && <div className="lc-account-error">{emState.error}</div>}
        {emState.success && (
          <div className="lc-account-success">{emState.success}</div>
        )}
        <form action={emAction} className="lc-account-form">
          <label className="lc-account-field">
            <span>New email</span>
            <input
              type="email"
              name="new_email"
              autoComplete="email"
              defaultValue={emState.values?.new_email ?? ""}
              required
              disabled={emPending}
            />
          </label>
          <div className="lc-account-form-actions">
            <button
              type="submit"
              className="lc-account-button"
              disabled={emPending}
            >
              {emPending ? "Sending…" : "Send verification"}
            </button>
          </div>
        </form>
      </div>

      <div className="lc-security-divider" />

      <div className="lc-security-section">
        <h3 className="lc-security-section-heading">Sign out</h3>
        <p className="lc-account-info">
          Sign out of this device. You&apos;ll need your email and password to
          come back.
        </p>
        <form action={signOut}>
          <button type="submit" className="lc-account-button-secondary">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
