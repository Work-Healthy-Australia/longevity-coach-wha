"use client";

import { useState } from "react";

import { acceptBookingRequest, declineBookingRequest } from "./actions";

export type PendingRequest = {
  id: string;
  patient_name: string;
  scheduled_at: string;
  duration_minutes: number;
  patient_notes: string | null;
};

type RequestCardProps = {
  request: PendingRequest;
  onConfirmed: (id: string) => void;
  onDeclined: (id: string) => void;
};

function RequestCard({ request, onConfirmed, onDeclined }: RequestCardProps) {
  const [status, setStatus] = useState<"idle" | "confirmed" | "declining">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedDate = new Date(request.scheduled_at).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function handleAccept() {
    setBusy(true);
    setError(null);
    const result = await acceptBookingRequest(request.id);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setStatus("confirmed");
      onConfirmed(request.id);
    }
  }

  async function handleDeclineConfirm() {
    setBusy(true);
    setError(null);
    const result = await declineBookingRequest(request.id, reason.trim() || undefined);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      onDeclined(request.id);
    }
  }

  return (
    <div className="sched-requests__card">
      <div className="sched-requests__patient-name">{request.patient_name}</div>
      <div className="sched-requests__meta">
        <span className="sched-requests__date">{formattedDate}</span>
        <span className="sched-requests__duration">{request.duration_minutes} min</span>
      </div>
      {request.patient_notes && (
        <div className="sched-requests__notes">{request.patient_notes}</div>
      )}

      {error && <div className="sched-requests__error">{error}</div>}

      {status === "confirmed" && (
        <div className="sched-requests__badge sched-requests__badge--confirmed">Confirmed</div>
      )}

      {status === "idle" && (
        <div className="sched-requests__actions">
          <button
            type="button"
            className="sched-requests__btn-accept"
            onClick={handleAccept}
            disabled={busy}
          >
            {busy ? "Accepting…" : "Accept"}
          </button>
          <button
            type="button"
            className="sched-requests__btn-decline"
            onClick={() => setStatus("declining")}
            disabled={busy}
          >
            Decline
          </button>
        </div>
      )}

      {status === "declining" && (
        <div className="sched-requests__decline-form">
          <textarea
            className="sched-requests__reason-input"
            placeholder="Reason for declining (optional)"
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="sched-requests__decline-actions">
            <button
              type="button"
              className="sched-requests__btn-decline-confirm"
              onClick={handleDeclineConfirm}
              disabled={busy}
            >
              {busy ? "Declining…" : "Confirm decline"}
            </button>
            <button
              type="button"
              className="sched-requests__btn-cancel"
              onClick={() => {
                setStatus("idle");
                setReason("");
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Props = { initialRequests: PendingRequest[] };

export function BookingRequests({ initialRequests }: Props) {
  const [requests, setRequests] = useState<PendingRequest[]>(initialRequests);

  function handleDeclined(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  function handleConfirmed(_id: string) {
    // Card shows "Confirmed" badge; we leave it in the list
  }

  if (requests.length === 0) {
    return (
      <div className="sched-requests">
        <div className="sched-requests__empty">No pending session requests.</div>
      </div>
    );
  }

  return (
    <div className="sched-requests">
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          onConfirmed={handleConfirmed}
          onDeclined={handleDeclined}
        />
      ))}
    </div>
  );
}
