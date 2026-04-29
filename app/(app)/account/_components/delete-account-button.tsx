'use client';

import { useActionState, useState } from 'react';

import { deleteAccount } from '../actions';

type State = { error?: string };

const initialState: State = {};

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialState,
  );

  if (!confirming) {
    return (
      <button className="btn-danger" onClick={() => setConfirming(true)}>
        Delete my account
      </button>
    );
  }

  return (
    <form action={formAction} className="delete-confirm">
      <p>
        <strong>Are you sure?</strong> This cannot be undone.
      </p>
      {/* Wave 2: hard-coded confirmation. Wave 3 will replace this with a
          real "type DELETE to confirm" text input. */}
      <input type="hidden" name="confirmation" value="DELETE" />
      <button type="submit" className="btn-danger" disabled={pending}>
        {pending ? 'Deleting…' : 'Yes, delete my account'}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
      {state?.error ? (
        <p className="error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
