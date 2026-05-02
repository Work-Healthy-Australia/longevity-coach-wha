import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateProgressNarrative } from "@/lib/insights/progress-narrative";
import { BioAgeHeroCard } from "./_components/bio-age-hero-card";
import { JanetChat } from "./_components/janet-chat";
import { SupplementRefreshButton } from "./_components/supplement-refresh-button";
import type { UIMessage } from "ai";
import "./report.css";

export const metadata = { title: "Report" };

function chronologicalAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentsDb = (admin as any).schema('agents');

  const [
    riskHistoryResult,
    supplementResult,
    healthResult,
    profileResult,
    conversationResult,
  ] = await Promise.all([
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

    supabase
      .from("profiles")
      .select("date_of_birth")
      .eq("id", user.id)
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
  const chronAge = chronologicalAge(
    (profileResult.data?.date_of_birth as string | null) ?? null,
  );

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

  const lastUpdated = [risk?.assessment_date, supplement?.created_at]
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  return (
    <div className="lc-report">
      <div className="lc-report-main">
      <header className="lc-report-header">
        <span className="lc-report-eyebrow">Janet Cares · Your report</span>
        <h1>Your <em>report</em></h1>
        <p className="lc-report-lede">
          Personalised biological age, risk profile, and supplement protocol —
          refreshed each time you log a new check-in.
        </p>
      </header>

      <BioAgeHeroCard
        risk={risk}
        chronologicalAge={chronAge}
        lastUpdated={lastUpdated ?? null}
      />

      {/* Risk narrative */}
      {risk?.narrative && (
        <section className="card">
          <div className="card-headline">
            <span className="card-eyebrow">Story · Your health</span>
            <h2>What your data is telling us</h2>
          </div>
          <p className="narrative">{risk.narrative}</p>
        </section>
      )}

      {/* Progress narrative */}
      {risk && (() => {
        const progress = generateProgressNarrative(risk, previousRisk);
        if (progress.trend === "insufficient" && !previousRisk) {
          return (
            <section className="card">
              <div className="card-headline">
                <span className="card-eyebrow">Progress · Trends</span>
                <h2>Your progress</h2>
              </div>
              <p className="narrative">{progress.headline}</p>
            </section>
          );
        }
        return (
          <section className="card">
            <div className="card-headline">
              <span className="card-eyebrow">Progress · Trends</span>
              <h2>Your progress</h2>
            </div>
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

      {/* Recommended screenings — collapsible */}
      {(risk?.recommended_screenings as string[])?.length > 0 && (
        <details className="info-accordion">
          <summary className="info-accordion-summary">
            <div className="info-accordion-summary-title">
              <span className="card-eyebrow">Screenings · Recommended</span>
              <span className="h2">Tests worth booking</span>
            </div>
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
          <div className="card-headline">
            <span className="card-eyebrow">Protocol · Supplements</span>
            <h2>Your protocol</h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
            Your supplement protocol hasn&apos;t been generated yet. Click &lsquo;Generate my protocol&rsquo; above to get started.
          </p>
        ) : (
          <div className="supplement-list">
            {(["critical", "high", "recommended", "performance"] as const).map((tier) => {
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

      </div>

      {/* Janet chat — sticky sidebar at desktop, stacks at mobile */}
      <aside className="lc-report-aside">
        <section className="card chat-section">
          <div className="card-headline">
            <span className="card-eyebrow">Janet · Ask</span>
            <h2>Ask your coach</h2>
          </div>
          <p className="section-note">
            Janet is your longevity coach. Ask about your results, supplements, lifestyle changes, or anything else.
          </p>
          <JanetChat initialMessages={priorTurns} userId={user.id} />
        </section>
      </aside>
    </div>
  );
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    critical: "Tier · Critical",
    high: "Tier · High priority",
    recommended: "Tier · Recommended",
    performance: "Tier · Performance",
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
