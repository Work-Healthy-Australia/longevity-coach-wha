"use client";

import { useActionState, useState } from "react";

import { saveAppointmentNotes, updateAppointmentStatus } from "../actions";

export type AppointmentRow = {
  id: string;
  patient_uuid: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
};

const NEXT_STATUS_OPTIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  no_show: ["confirmed", "completed", "cancelled"],
  completed: [],
  cancelled: ["confirmed"],
};

export function ScheduleClient({ rows }: { rows: AppointmentRow[] }) {
  const [statusState, statusAction, statusPending] = useActionState(updateAppointmentStatus, null);
  const [notesState, notesAction, notesPending] = useActionState(saveAppointmentNotes, null);
  const [openId, setOpenId] = useState<string | null>(null);

  const error = statusState?.error ?? notesState?.error;
  const success = statusState?.success ?? notesState?.success;

  if (rows.length === 0) {
    return <div className="muted">No appointments.</div>;
  }

  return (
    <div>
      {error && <div className="cw-error">{error}</div>}
      {success && <div className="cw-success">{success}</div>}

      <ul className="sched-list">
        {rows.map((a) => {
          const isOpen = openId === a.id;
          const transitions = NEXT_STATUS_OPTIONS[a.status] ?? [];
          return (
            <li key={a.id}>
              <button
                type="button"
                className="row"
                onClick={() => setOpenId(isOpen ? null : a.id)}
                style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
              >
                <span className="when">
                  {new Date(a.scheduled_at).toLocaleString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>Patient {a.patient_uuid.slice(0, 8)}</span>
                <span className="badge">{a.status.replace(/_/g, " ")}</span>
                <span style={{ marginLeft: "auto", color: "#888", fontSize: 12 }}>
                  {a.duration_minutes} min
                </span>
              </button>

              {isOpen && (
                <div style={{ marginTop: 12, fontSize: 14, display: "grid", gap: 10 }}>
                  {a.notes && <div><strong>Notes:</strong> {a.notes}</div>}

                  {transitions.length > 0 && (
                    <form action={statusAction} style={{ display: "flex", gap: 8 }}>
                      <input type="hidden" name="appointmentId" value={a.id} />
                      {transitions.map((s) => (
                        <button key={s} type="submit" name="status" value={s} disabled={statusPending}>
                          Mark {s.replace(/_/g, " ")}
                        </button>
                      ))}
                    </form>
                  )}

                  <form action={notesAction}>
                    <input type="hidden" name="appointmentId" value={a.id} />
                    <textarea
                      name="clinician_notes"
                      defaultValue={a.notes ?? ""}
                      rows={4}
                      placeholder="Post-session notes…"
                      style={{ width: "100%", padding: 8, border: "1px solid #ddd6c0", borderRadius: 6 }}
                    />
                    <div className="cw-actions" style={{ marginTop: 6 }}>
                      <button type="submit" disabled={notesPending}>
                        {notesPending ? "Saving…" : "Save notes"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
