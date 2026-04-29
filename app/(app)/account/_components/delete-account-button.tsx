'use client';

import { useState } from 'react';
import { deleteAccount } from '../actions';

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirming) {
    return (
      <button className="btn-danger" onClick={() => setConfirming(true)}>
        Delete my account
      </button>
    );
  }

  return (
    <div className="delete-confirm">
      <p>
        <strong>Are you sure?</strong> This cannot be undone.
      </p>
      <button
        className="btn-danger"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await deleteAccount();
        }}
      >
        {pending ? 'Deleting…' : 'Yes, delete my account'}
      </button>
      <button className="btn-secondary" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </div>
  );
}
