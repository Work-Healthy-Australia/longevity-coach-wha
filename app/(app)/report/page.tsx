import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanLegacyDriver } from "@/lib/risk/format-driver";
import { generateProgressNarrative } from "@/lib/insights/progress-narrative";
import { JanetChat } from "./_components/janet-chat";
import { SupplementRefreshButton } from "./_components/supplement-refresh-button";
import { RegenerateButton } from "./_components/regenerate-button";
import type { UIMessage } from "ai";
import "./report.css";

export const metadata = { title: "Your Report · Longevity Coach" };

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentsDb = (admin as any).schema('agents');

  const [riskHistoryResult, supplementResult, healthResult, conversationResult] = await Promise.all([
    supabase
      .from("risk_scores")
      .select("biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, narrative, top_risk_drivers, top_protective_levers, recommended_screenings, confidence_level, data_gaps, assessment_date")
      .eq("user_uuid", user.id)
      .order("assessment_date", { ascending: false })
      .limit(2),

    supabase
      .from("supplement_plans")
      .select("items, created_at, notes")
      .eq("patient_uuid", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("health_profiles")
      .select("completed_at")
      .eq("user_uuid", user.id)
      .not("completed_at", "is", null)
      .limit(1)
      .maybeSingle(),

    agentsDb
      .from("agent_conversations")
      .select("role, content, created_at")
      .eq("user_uuid", user.id)
      .eq("agent", "janet")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const riskRows = riskHistoryResult.data ?? [];
  const risk = riskRows[0] ?? null;
  const previousRisk = riskRows[1] ?? null;
  const supplement = supplementResult.data;
  const hasAssessment = !!healthResult.data;

  const priorTurns = ([...(conversationResult.data ?? [])].reverse() as Array<{ role: string; content: string; created_at: string }>)
    .map((t, i): UIMessage => ({
      id: `prior-${i}`,
      role: t.role as "user" | "assistant",
      parts: [{ type: "text", text: t.content }],
    }));

  if (!hasAssessment) {
    redirect("/onboarding");
  }

  type SupplementItem = {
    name: string;
    form: string;
    dosage: string;
    timing: string;
    priority: "critical" | "high" | "recommended" | "performance";
    domains: string[];
    rationale: string;
    note?: string;
  };

  const supplements = (supplement?.items as unknown as SupplementItem[]) ?? [];

  const domains: [string, number | null][] = [
    ["Cardiovascular", risk?.cv_risk ?? null],
    ["Metabolic", risk?.metabolic_risk ?? null],
    ["Neurological", risk?.neuro_risk ?? null],
    ["Oncological", risk?.onco_risk ?? null],
    ["Musculoskeletal", risk?.msk_risk ?? null],
  ];

  const lastUpdated = [risk?.assessment_date, supplement?.created_at]
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="lc-report">

      {/* Bio-age hero */}
      <section className="bio-age-hero">
        {risk?.biological_age != null ? (
          <>
            <div className="bio-age-number">{Math.round(risk.biological_age)}</div>
            <div className="bio-age-label">Biological age</div>
            {risk.confidence_level && (
              <span className={`confidence-badge confidence-${risk.confidence_level}`}>
                {risk.confidence_level} confidence
              </span>
            )}
            {lastUpdated && (
              <div className="report-updated">Last updated {formatDate(lastUpdated)}</div>
            )}
            <RegenerateButton />
          </>
        ) : (
          <div className="pending-state">
            <div className="pending-icon">⏳</div>
            <h2>Your report is being prepared</h2>
            <p>
              It takes a few minutes to analyse your assessment. Ask Janet below —
              she can help while your report processes.
            </p>
            <RegenerateButton />
          </div>
        )}
      </section>

      {/* Risk domains + Top risk factors */}
      <div className="two-col">
        <section className="card">
          <h2>Risk domains</h2>
          <p className="section-note">0 = optimal · 100 = highest risk</p>
          <div className="domains-grid">
            {domains.map(([label, value]) => (
              <div key={label} className="domain-card">
                <div className="domain-label">{label}</div>
                {value != null ? (
                  <>
                    <div className={`domain-value ${riskClass(value)}`}>
                      {Math.round(value)}
                    </div>
                    <div className="domain-bar">
                      <div
                        className={`domain-bar-fill ${riskClass(value)}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="domain-value pending">—</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Top risk factors to address</h2>
          {(risk?.top_risk_drivers as string[])?.length > 0 ? (
            <ol className="driver-list">
              {(risk?.top_risk_drivers as string[]).map((d, i) => (
                <li key={i}>{cleanLegacyDriver(d)}</li>
              ))}
            </ol>
          ) : (
            <p className="muted-text placeholder-text">
              Your personalised risk factors will appear here once your health
              assessment has been fully analysed. This typically takes a few
              minutes after completing the questionnaire.
            </p>
          )}
        </section>
      </div>

      {/* Risk narrative — collapsible (long text, secondary read) */}
      {risk?.narrative && (
        <details className="info-accordion" open>
          <summary className="info-accordion-summary">
            Your health story
            <span className="info-accordion-chevron" aria-hidden="true">▾</span>
          </summary>
          <div className="info-accordion-body">
            <p className="narrative">{risk.narrative}</p>
          </div>
        </details>
      )}

      {/* Progress narrative */}
      {risk && (() => {
        const progress = generateProgressNarrative(risk, previousRisk);
        if (progress.trend === "insufficient" && !previousRisk) {
          return (
            <section className="card progress-section">
              <h2>Your progress</h2>
              <p className="narrative">{progress.headline}</p>
            </section>
          );
        }
        return (
          <section className="card progress-section">
            <h2>Your progress</h2>
            <div className={`progress-trend progress-trend-${progress.trend}`}>
              <span className="progress-trend-icon">
                {progress.trend === "improving" ? "↗" : progress.trend === "declining" ? "↘" : "→"}
              </span>
              <span>{progress.headline}</span>
            </div>
            {progress.bullets.length > 0 && (
              <ul className="progress-bullets">
                {progress.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })()}

      {/* Recommended screenings — collapsible (supplementary info) */}
      {(risk?.recommended_screenings as string[])?.length > 0 && (
        <details className="info-accordion">
          <summary className="info-accordion-summary">
            Recommended screenings
            <span className="info-accordion-chevron" aria-hidden="true">▾</span>
          </summary>
          <div className="info-accordion-body">
            <ul className="screening-list">
              {(risk?.recommended_screenings as string[]).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {/* Supplement protocol */}
      <section className="card">
        <div className="card-head">
          <h2>Your supplement protocol</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <SupplementRefreshButton hasProtocol={supplements.length > 0} />
            {supplement?.created_at && (
              <span className="badge muted">
                Updated {formatDate(supplement.created_at)}
              </span>
            )}
          </div>
        </div>

        {supplements.length === 0 ? (
          <p className="muted-text">
            Your supplement protocol hasn&apos;t been generated yet. Click &apos;Generate my protocol&apos; above to get started.
          </p>
        ) : (
          <div className="supplement-list">
            {["critical", "high", "recommended", "performance"].map((tier) => {
              const tierItems = supplements.filter((s) => s.priority === tier);
              if (!tierItems.length) return null;
              return (
                <details key={tier} className="supplement-tier supplement-accordion" open>
                  <summary className={`supplement-accordion-summary tier-label tier-${tier}`}>
                    <span>{tierLabel(tier)}</span>
                    <span className="supplement-accordion-meta">
                      <span className="supplement-accordion-count">{tierItems.length}</span>
                      <span className="supplement-collapse-chevron" aria-hidden="true">▾</span>
                    </span>
                  </summary>
                  <div className="supplement-accordion-body">
                    {tierItems.map((s, i) => (
                      <div key={i} className="supplement-item">
                        <div className="supplement-header">
                          <span className="supplement-name">{s.name}</span>
                          <span className="supplement-dosage">
                            {s.dosage} · {s.form}
                          </span>
                        </div>
                        <div className="supplement-timing">{s.timing}</div>
                        <div className="supplement-rationale">{s.rationale}</div>
                        {s.note && (
                          <div className="supplement-note">⚠ {s.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
      {/* Janet */}
      <section className="card chat-section">
        <h2>Ask Janet</h2>
        <p className="section-note">
          Janet is your longevity health coach. Ask about your results, supplements,
          lifestyle changes, or anything else on your mind.
        </p>
        <JanetChat initialMessages={priorTurns} userId={user.id} />
      </section>

    </div>
  );
}

function riskClass(value: number): string {
  if (value <= 25) return "risk-optimal";
  if (value <= 45) return "risk-low";
  if (value <= 65) return "risk-moderate";
  if (value <= 80) return "risk-high";
  return "risk-critical";
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    critical: "Critical",
    high: "High priority",
    recommended: "Recommended",
    performance: "Performance",
  };
  return labels[tier] ?? tier;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
