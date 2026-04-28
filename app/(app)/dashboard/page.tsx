import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import "./dashboard.css";

export const metadata = { title: "Dashboard · Longevity Coach" };

const ACTIVE_SUB_STATUSES = new Set(["trialing", "active", "past_due"]);

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Latest health profile (any state - draft or completed).
  const { data: assessment } = await supabase
    .from("health_profiles")
    .select("id, completed_at, updated_at, responses")
    .eq("user_uuid", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Latest risk score, if the engine has run.
  const { data: risk } = await supabase
    .from("risk_scores")
    .select("biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, computed_at")
    .eq("user_uuid", user!.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Upload count for the uploads card.
  const { count: uploadCount } = await supabase
    .from("patient_uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_uuid", user!.id);

  // Most recent subscription, regardless of status.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_uuid", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const firstName =
    (user!.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    (assessment?.responses as { basics?: { first_name?: string } } | null)?.basics?.first_name ??
    null;

  const assessmentState: "none" | "draft" | "complete" = !assessment
    ? "none"
    : assessment.completed_at
      ? "complete"
      : "draft";

  const subActive = subscription && ACTIVE_SUB_STATUSES.has(subscription.status);

  return (
    <div className="lc-dash">
      <h1>Welcome{firstName ? `, ${firstName}` : ""}.</h1>
      <p className="subtitle">
        {assessmentState === "complete"
          ? "Your assessment is in. Risk scores will appear below as soon as the engine runs."
          : "Two minutes to set up. Ten to complete your assessment."}
      </p>

      <div className="grid">
        {/* Assessment status */}
        <div className="card">
          <div className="head">
            <h2>Health assessment</h2>
            <AssessmentBadge state={assessmentState} />
          </div>
          {assessmentState === "none" && (
            <>
              <p>
                A short questionnaire across six areas: about you, medical history,
                family history, lifestyle, your goals, and consent. Roughly 10 minutes.
              </p>
              <Link className="btn btn-primary" href="/onboarding">
                Start your assessment
              </Link>
            </>
          )}
          {assessmentState === "draft" && (
            <>
              <p>
                You have a draft in progress. Pick up where you left off.
              </p>
              <Link className="btn btn-primary" href="/onboarding">
                Resume assessment
              </Link>
            </>
          )}
          {assessmentState === "complete" && (
            <>
              <p>
                Submitted on {formatDate(assessment!.completed_at!)}.
                You can update your responses any time.
              </p>
              <Link className="btn btn-ghost" href="/onboarding">
                Update responses
              </Link>
            </>
          )}
        </div>

        {/* Subscription status */}
        <div className="card">
          <div className="head">
            <h2>Subscription</h2>
            <SubscriptionBadge subscription={subscription} />
          </div>
          {!subscription && (
            <>
              <p>
                You&apos;re on the free baseline. Upgrade to unlock the full
                supplement protocol, branded PDF, and ongoing coaching.
              </p>
              <span className="badge muted">Plans coming soon</span>
            </>
          )}
          {subscription && subActive && (
            <p>
              Active subscription. Renews on {formatDate(subscription.current_period_end)}
              {subscription.cancel_at_period_end ? " (cancels at period end)" : ""}.
            </p>
          )}
          {subscription && !subActive && (
            <p>
              Subscription is currently {subscription.status}. Contact support if
              you believe this is an error.
            </p>
          )}
        </div>
      </div>

      {/* Uploads card */}
        <div className="card">
          <div className="head">
            <h2>My documents</h2>
            {uploadCount != null && uploadCount > 0 && (
              <span className="badge primary">{uploadCount} file{uploadCount !== 1 ? "s" : ""}</span>
            )}
          </div>
          {assessmentState !== "complete" ? (
            <p>Complete your health assessment first, then upload your previous pathology and imaging.</p>
          ) : uploadCount === 0 ? (
            <>
              <p>
                Upload blood work, imaging, genetic tests, or any pathology.
                Janet reads and categorises each file to improve your risk scores.
              </p>
              <Link className="btn btn-primary" href="/uploads">
                Upload documents
              </Link>
            </>
          ) : (
            <>
              <p>
                {uploadCount} document{uploadCount !== 1 ? "s" : ""} uploaded.
                Janet uses these alongside your questionnaire to refine your risk profile.
              </p>
              <Link className="btn btn-ghost" href="/uploads">
                View documents
              </Link>
            </>
          )}
        </div>

      {/* Risk scores */}
      <div className="card">
        <div className="head">
          <h2>Your risk profile</h2>
          <div className="head-badges">
            {risk && <span className="badge muted" title="These scores are produced by an LLM and have not been clinically validated. Treat as preview pending the actuarial-table-backed engine.">Preview</span>}
            {risk?.biological_age != null && (
              <span className="badge primary">Bio-age {risk.biological_age}</span>
            )}
          </div>
        </div>
        {!risk && (
          <>
            <p>
              {assessmentState === "complete"
                ? "Risk scores appear here once the engine has processed your assessment."
                : "Complete your assessment to see your biological age and risk scores across five domains."}
            </p>
            <div className="empty-scores">
              {["Cardiovascular", "Metabolic", "Neurological", "Oncological", "Musculoskeletal"].map(
                (label) => (
                  <div className="empty-score" key={label}>
                    <div className="label">{label}</div>
                    <div className="value">-</div>
                  </div>
                ),
              )}
            </div>
          </>
        )}
        {risk && (
          <div className="empty-scores">
            {[
              ["Cardiovascular", risk.cv_risk],
              ["Metabolic", risk.metabolic_risk],
              ["Neurological", risk.neuro_risk],
              ["Oncological", risk.onco_risk],
              ["Musculoskeletal", risk.msk_risk],
            ].map(([label, value]) => (
              <div className="empty-score" key={label as string}>
                <div className="label">{label as string}</div>
                <div className="value" style={value != null ? { color: "var(--lc-ink)" } : undefined}>
                  {value ?? "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentBadge({ state }: { state: "none" | "draft" | "complete" }) {
  if (state === "complete") return <span className="badge success">Complete</span>;
  if (state === "draft") return <span className="badge warning">In progress</span>;
  return <span className="badge muted">Not started</span>;
}

function SubscriptionBadge({
  subscription,
}: {
  subscription: { status: string } | null;
}) {
  if (!subscription) return <span className="badge muted">Free</span>;
  if (subscription.status === "active" || subscription.status === "trialing")
    return <span className="badge success">{subscription.status}</span>;
  if (subscription.status === "past_due")
    return <span className="badge warning">Past due</span>;
  return <span className="badge muted">{subscription.status}</span>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
