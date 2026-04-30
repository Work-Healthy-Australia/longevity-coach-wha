"use client";

import { useState, useTransition } from "react";

import { cancelBooking } from "@/app/(app)/care-team/actions";
import { toast } from "@/lib/toast/store";

export default function CancelSessionButton({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await cancelBooking(appointmentId);
      if ("success" in result) {
        toast("Session cancelled.", "success");
      } else {
        toast(result.error, "error");
      }
      setConfirmOpen(false);
    });
  }

  if (!confirmOpen) {
    return (
      <button
        type="button"
        className="lc-care__cancel-btn"
        onClick={() => setConfirmOpen(true)}
      >
        Cancel
      </button>
    );
  }

  return (
    <div className="lc-care__cancel-confirm" role="alertdialog" aria-label="Confirm cancellation">
      <p className="lc-care__cancel-confirm-text">
        Cancel this session? This cannot be undone.
      </p>
      <div className="lc-care__cancel-confirm-actions">
        <button
          type="button"
          className="lc-care__cancel-keep"
          onClick={() => setConfirmOpen(false)}
          disabled={pending}
        >
          Keep session
        </button>
        <button
          type="button"
          className="lc-care__cancel-confirm-btn"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Cancelling…" : "Cancel session"}
        </button>
      </div>
    </div>
  );
}
