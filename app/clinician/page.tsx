import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { createClient } from "@/lib/supabase/server";

import { ReviewDetail } from "./_components/review-detail";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ id?: string; tab?: string }>;

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

const STATUS_GROUPS: { key: string; label: string }[] = [
  { key: "awaiting_clinician", label: "Awaiting clinician" },
  { key: "in_review", label: "In review" },
  { key: "program_ready", label: "Program ready" },
  { key: "sent_to_patient", label: "Sent to patient" },
];

function patientLabel(uuid: string): string {
  return `Patient ${uuid.slice(0, 8)}`;
}

function isUrgent(r: ReviewRow): boolean {
  return r.overall_sentiment === "needs_attention" || (r.stress_level ?? 0) >= 8;
}

export default async function ClinicianHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { id: selectedId, tab } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Show all reviews this clinician can see (own assigned + admin sees all).
  // Admin client used because RLS for unassigned reviews would block this query
  // and we already gated entry via the layout.
  const admin = createAdminClient();
  // program_30_day + program_sent_at landed in migration 0049 — types regen pending.
  const { data } = await loose(admin)
    .from("periodic_reviews")
    .select(
      "id, patient_uuid, clinician_uuid, review_month, review_status, overall_sentiment, stress_level, adherence_score, janet_brief, wins, next_goals, support_needed, open_space, adherence_notes, stress_notes, ai_summary, program_30_day, program_sent_at"
    )
    .order("review_month", { ascending: false, nullsFirst: false });

  const allRows: ReviewRow[] = ((data ?? []) as ReviewRow[]).filter(
    (r) => Boolean(r.review_status)
  );

  // If the clinician is non-admin, narrow to their assignments.
  let rows = allRows;
  if (user) {
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      const { data: assignments } = await admin
        .from("patient_assignments")
        .select("patient_uuid")
        .eq("clinician_uuid", user.id)
        .eq("status", "active");
      const patientIds = new Set((assignments ?? []).map((a) => a.patient_uuid));
      rows = allRows.filter((r) => patientIds.has(r.patient_uuid));
    }
  }

  const grouped = STATUS_GROUPS.map((g) => ({
    ...g,
    rows: rows
      .filter((r) => r.review_status === g.key)
      .sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a))),
  }));

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const activeTab = (tab as "patient" | "janet" | "program" | undefined) ?? "patient";

  return (
    <div className="cw-layout">
      <aside className="cw-queue">
        <h1 style={{ fontSize: 18, margin: "4px 8px 12px" }}>Reviews</h1>
        {grouped.every((g) => g.rows.length === 0) && (
          <div className="muted" style={{ padding: 12 }}>No reviews yet.</div>
        )}
        {grouped.map((g) => (
          <div key={g.key}>
            <h2>{g.label} ({g.rows.length})</h2>
            {g.rows.map((r) => (
              <Link
                key={r.id}
                href={`/clinician?id=${r.id}`}
                className={`cw-card${selected?.id === r.id ? " selected" : ""}${
                  isUrgent(r) ? " urgent" : ""
                }`}
              >
                <div>{patientLabel(r.patient_uuid)}</div>
                <div className="meta">
                  {r.review_month && <span>{new Date(r.review_month).toLocaleDateString()}</span>}
                  {r.overall_sentiment && (
                    <span className={`badge ${r.overall_sentiment}`}>
                      {r.overall_sentiment.replace(/_/g, " ")}
                    </span>
                  )}
                  {(r.stress_level ?? 0) >= 7 && (
                    <span className="badge needs_attention">stress {r.stress_level}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ))}
      </aside>

      <section className="cw-detail">
        {!selected ? (
          <div className="cw-empty">Select a review to begin.</div>
        ) : (
          <ReviewDetail review={selected} activeTab={activeTab} />
        )}
      </section>
    </div>
  );
}
