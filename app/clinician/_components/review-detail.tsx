"use client";

import Link from "next/link";
import { useActionState } from "react";

import { approveAndSend, saveProgram, startReview } from "../actions";
import { ClinicianJanetChat } from "./janet-chat";

type ReviewRow = {
  id: string;
  patient_uuid: string;
  review_month: string | null;
  review_status: string;
  overall_sentiment: string | null;
  stress_level: number | null;
  adherence_score: number | null;
  janet_brief: string | null;
  wins: string[];
  next_goals: string[];
  support_needed: string | null;
  open_space: string | null;
  adherence_notes: string | null;
  stress_notes: string | null;
  ai_summary: string | null;
  program_30_day: string | null;
  program_sent_at: string | null;
};

type Tab = "patient" | "janet" | "program";

const TABS: { key: Tab; label: string }[] = [
  { key: "patient", label: "Patient card" },
  { key: "janet", label: "Janet chat" },
  { key: "program", label: "30-Day program" },
];

export function ReviewDetail({
  review,
  activeTab,
}: {
  review: ReviewRow;
  activeTab: Tab;
}) {
  const [startState, startAction, startPending] = useActionState(startReview, null);
  const [saveState, saveAction, savePending] = useActionState(saveProgram, null);
  const [sendState, sendAction, sendPending] = useActionState(approveAndSend, null);

  const error = startState?.error ?? saveState?.error ?? sendState?.error;
  const success = startState?.success ?? saveState?.success ?? sendState?.success;

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>
          Patient {review.patient_uuid.slice(0, 8)}
        </h1>
        <div className="muted" style={{ fontSize: 13 }}>
          {review.review_month && new Date(review.review_month).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
          {" · "}
          <span className="badge">{review.review_status.replace(/_/g, " ")}</span>
        </div>
      </header>

      {error && <div className="cw-error">{error}</div>}
      {success && <div className="cw-success">{success}</div>}

      <div className="cw-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clinician?id=${review.id}&tab=${t.key}`}
            className={t.key === activeTab ? "active" : ""}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "patient" && (
        <PatientCardTab
          review={review}
          startAction={startAction}
          startPending={startPending}
        />
      )}

      {activeTab === "janet" && <ClinicianJanetChat reviewId={review.id} />}

      {activeTab === "program" && (
        <ProgramTab
          review={review}
          saveAction={saveAction}
          sendAction={sendAction}
          savePending={savePending}
          sendPending={sendPending}
        />
      )}
    </div>
  );
}

function PatientCardTab({
  review,
  startAction,
  startPending,
}: {
  review: ReviewRow;
  startAction: (formData: FormData) => void;
  startPending: boolean;
}) {
  return (
    <div>
      {review.janet_brief && (
        <div className="cw-section">
          <h3>Janet&rsquo;s brief</h3>
          <div className="cw-callout">{review.janet_brief}</div>
        </div>
      )}

      {review.wins.length > 0 && (
        <div className="cw-section">
          <h3>Wins</h3>
          <ul>{review.wins.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      <div className="cw-section">
        <h3>Adherence</h3>
        <div>
          {review.adherence_score !== null ? `${review.adherence_score} / 100` : "—"}
        </div>
        {review.adherence_notes && <div className="muted">{review.adherence_notes}</div>}
      </div>

      <div className="cw-section">
        <h3>Stress</h3>
        <div>{review.stress_level !== null ? `${review.stress_level} / 10` : "—"}</div>
        {review.stress_notes && <div className="muted">{review.stress_notes}</div>}
      </div>

      {review.next_goals.length > 0 && (
        <div className="cw-section">
          <h3>Next goals</h3>
          <ul>{review.next_goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
      )}

      {review.support_needed && (
        <div className="cw-section">
          <h3>Support needed</h3>
          <div>{review.support_needed}</div>
        </div>
      )}

      {review.open_space && (
        <div className="cw-section">
          <h3>Open space</h3>
          <div>{review.open_space}</div>
        </div>
      )}

      {review.review_status === "awaiting_clinician" && (
        <form action={startAction}>
          <input type="hidden" name="reviewId" value={review.id} />
          <div className="cw-actions">
            <button type="submit" disabled={startPending}>
              {startPending ? "Opening…" : "Start review"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ProgramTab({
  review,
  saveAction,
  sendAction,
  savePending,
  sendPending,
}: {
  review: ReviewRow;
  saveAction: (formData: FormData) => void;
  sendAction: (formData: FormData) => void;
  savePending: boolean;
  sendPending: boolean;
}) {
  return (
    <div className="cw-program">
      {review.program_sent_at && (
        <div className="cw-success">
          <span suppressHydrationWarning>Sent to patient on {new Date(review.program_sent_at).toLocaleString()}.</span>
        </div>
      )}
      <form action={saveAction}>
        <input type="hidden" name="reviewId" value={review.id} />
        <textarea
          name="program_30_day"
          defaultValue={review.program_30_day ?? ""}
          placeholder="Paste or write the 30-day program here. Janet's draft will land here automatically once Wave 10 lands."
        />
        <div className="cw-actions">
          <button type="submit" className="secondary" disabled={savePending || sendPending}>
            {savePending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>

      <form action={sendAction} style={{ marginTop: 8 }}>
        <input type="hidden" name="reviewId" value={review.id} />
        <input
          type="hidden"
          name="program_30_day"
          value={review.program_30_day ?? ""}
        />
        <div className="cw-actions">
          <button type="submit" disabled={sendPending || savePending}>
            {sendPending ? "Sending…" : "Approve & send to patient"}
          </button>
        </div>
      </form>
    </div>
  );
}
