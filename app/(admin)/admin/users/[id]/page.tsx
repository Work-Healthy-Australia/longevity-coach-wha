import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const [profileResult, healthResult, riskResult, supplementResult, subResult, uploadsResult] =
    await Promise.all([
      admin.from("profiles").select("id, full_name, date_of_birth, created_at").eq("id", id).single(),
      admin
        .from("health_profiles")
        .select("responses, completed_at")
        .eq("user_uuid", id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("risk_scores")
        .select(
          "biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, longevity_score, confidence_level, narrative, top_risk_drivers, recommended_screenings, assessment_date",
        )
        .eq("user_uuid", id)
        .order("assessment_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("supplement_plans")
        .select("items, created_at, notes, status")
        .eq("patient_uuid", id)
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("subscriptions")
        .select("status, price_id, current_period_end, created_at")
        .eq("user_uuid", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("patient_uploads")
        .select("original_filename, janet_category, janet_status, created_at")
        .eq("user_uuid", id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (!profileResult.data) notFound();

  const profile = profileResult.data;
  const health = healthResult.data;
  const risk = riskResult.data;
  const supplementPlans = supplementResult.data ?? [];
  const sub = subResult.data;
  const uploads = uploadsResult.data ?? [];

  // Server component — runs once per request, so the impure-function rule
  // doesn't introduce the re-render instability it warns about.
  // eslint-disable-next-line react-hooks/purity
  const requestNow = Date.now();
  const ageYears = profile.date_of_birth
    ? Math.floor(
        (requestNow - new Date(profile.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const domains: [string, number | null][] = [
    ["CV", risk?.cv_risk ?? null],
    ["Metabolic", risk?.metabolic_risk ?? null],
    ["Neuro", risk?.neuro_risk ?? null],
    ["Onco", risk?.onco_risk ?? null],
    ["MSK", risk?.msk_risk ?? null],
  ];

  return (
    <div className="admin-content">
      <div className="back-link">
        <Link href="/admin/users">← Back to users</Link>
      </div>

      <div className="detail-header">
        <div>
          <h1 className="detail-name">{profile.full_name ?? "Unknown user"}</h1>
          <p className="detail-meta">
            Signed up {formatDate(profile.created_at)}
            {ageYears ? ` · Age ${ageYears}` : ""}
          </p>
        </div>
        {sub && (
          <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
        )}
      </div>

      <div className="detail-grid">
        {/* Subscription */}
        <div className="admin-card">
          <h2 className="admin-card-title">Subscription</h2>
          {sub ? (
            <dl className="detail-dl">
              <dt>Status</dt>
              <dd><span className={`status-badge status-${sub.status}`}>{sub.status}</span></dd>
              <dt>Plan</dt>
              <dd>{sub.price_id ?? "—"}</dd>
              <dt>Renews</dt>
              <dd>{formatDate(sub.current_period_end)}</dd>
              <dt>Started</dt>
              <dd>{formatDate(sub.created_at)}</dd>
            </dl>
          ) : (
            <p className="muted-cell">No subscription found.</p>
          )}
        </div>

        {/* Risk scores */}
        <div className="admin-card">
          <h2 className="admin-card-title">Risk scores</h2>
          {risk ? (
            <>
              <div className="detail-bio-age">
                <span className="detail-bio-number">{Math.round(risk.biological_age ?? 0)}</span>
                <span className="detail-bio-label">Biological age</span>
                <span className="badge">{risk.confidence_level} confidence</span>
              </div>
              <div className="domain-row">
                {domains.map(([label, value]) => (
                  <div key={label} className="domain-mini">
                    <div className="domain-mini-label">{label}</div>
                    <div
                      className="domain-mini-value"
                      style={{ color: riskColor(value ?? 50) }}
                    >
                      {value != null ? Math.round(value) : "—"}
                    </div>
                  </div>
                ))}
              </div>
              {risk.narrative && (
                <p className="detail-narrative">{risk.narrative}</p>
              )}
            </>
          ) : (
            <p className="muted-cell">No assessment completed.</p>
          )}
        </div>

        {/* Assessment */}
        <div className="admin-card">
          <h2 className="admin-card-title">Health assessment</h2>
          {health ? (
            <>
              <p className="muted-cell">Completed {formatDate(health.completed_at)}</p>
              <details className="response-details">
                <summary>View responses</summary>
                <pre className="response-json">
                  {JSON.stringify(health.responses, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <p className="muted-cell">Not completed.</p>
          )}
        </div>

        {/* Documents */}
        <div className="admin-card">
          <h2 className="admin-card-title">Uploaded documents</h2>
          {uploads.length > 0 ? (
            <table className="admin-table small">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u, i) => (
                  <tr key={i}>
                    <td>{u.original_filename}</td>
                    <td>{u.janet_category ?? "—"}</td>
                    <td>
                      <span className={`status-badge status-${u.janet_status}`}>
                        {u.janet_status}
                      </span>
                    </td>
                    <td>{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted-cell">No documents uploaded.</p>
          )}
        </div>

        {/* Supplement plans */}
        <div className="admin-card full-width">
          <h2 className="admin-card-title">Supplement plans</h2>
          {supplementPlans.length > 0 ? (
            supplementPlans.map((plan, i) => (
              <details key={i} className="response-details">
                <summary>
                  {formatDate(plan.created_at)} ·{" "}
                  <span className={`status-badge status-${plan.status}`}>{plan.status}</span>
                </summary>
                <pre className="response-json">{JSON.stringify(plan.items, null, 2)}</pre>
              </details>
            ))
          ) : (
            <p className="muted-cell">No supplement plans generated yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function riskColor(value: number): string {
  if (value <= 25) return "#22863A";
  if (value <= 45) return "#16A34A";
  if (value <= 65) return "#B45309";
  if (value <= 80) return "#D97706";
  return "#C0392B";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
