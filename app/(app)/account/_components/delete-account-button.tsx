'use client';

import { useActionState, useState } from 'react';

import { deleteAccount } from '../actions';

type State = { error?: string };

const initialState: State = {};

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialState,
  );

  if (!confirming) {
    return (
      <button className="lc-account-button-danger" onClick={() => setConfirming(true)}>
        Delete my account
      </button>
    );
  }

  return (
    <form action={formAction} className="lc-delete-confirm">
      <h4>This cannot be undone.</h4>

      <p className="lc-delete-confirm-section-label">Removed permanently:</p>
      <ul>
        <li>
          Your identifiers (name, date of birth, phone, address)
        </li>
        <li>Uploads, conversations, journal entries, daily logs</li>
        <li>Lab results, supplement protocol, risk scores</li>
      </ul>

      <p className="lc-delete-confirm-section-label">
        Retained anonymised for AHPRA compliance:
      </p>
      <ul>
        <li>Consent history</li>
        <li>Clinical notes from your care team</li>
        <li>Periodic reviews</li>
      </ul>
      <p className="lc-delete-confirm-note">
        Your nominated clinician will see &ldquo;patient erased&rdquo; instead
        of your name.
      </p>

      {state?.error ? (
        <p className="lc-delete-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <label className="lc-delete-confirm-label">
        Type <strong>DELETE</strong> to confirm
        <input
          type="text"
          name="confirmation"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={pending}
        />
      </label>

      <div className="lc-delete-confirm-actions">
        <button
          type="submit"
          className="lc-account-button-danger"
          disabled={pending || typed !== 'DELETE'}
        >
          {pending ? 'Deleting…' : 'Yes, delete my account'}
        </button>
        <button
          type="button"
          className="lc-account-button-secondary"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setTyped('');
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
