import { RegenerateButton } from "./regenerate-button";

type Risk = {
  biological_age: number | null;
  cv_risk: number | null;
  metabolic_risk: number | null;
  neuro_risk: number | null;
  onco_risk: number | null;
  msk_risk: number | null;
  confidence_level: string | null;
  assessment_date: string;
};

const DOMAINS = [
  { key: "cv_risk", label: "Cardiovascular" },
  { key: "metabolic_risk", label: "Metabolic" },
  { key: "neuro_risk", label: "Neurological" },
  { key: "onco_risk", label: "Oncological" },
  { key: "msk_risk", label: "Musculoskeletal" },
] as const;

function bandFor(value: number): { fill: "low" | "mid" | "high"; label: string } {
  if (value <= 35) return { fill: "low", label: "Low" };
  if (value <= 65) return { fill: "mid", label: "Mod" };
  return { fill: "high", label: "High" };
}

function formatMonth(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-AU", { month: "short", year: "numeric" })
    .toUpperCase()
    .replace(" ", " · ");
}

function formatLastUpdated(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export function BioAgeHeroCard({
  risk,
  chronologicalAge,
  lastUpdated,
}: {
  risk: Risk | null;
  chronologicalAge: number | null;
  lastUpdated: string | null;
}) {
  if (!risk || risk.biological_age == null) {
    return (
      <div className="lc-report-card">
        <div className="lc-report-card-tab">
          <span className="lc-report-card-pill">Bio-Age Report</span>
          <span className="lc-report-card-date">PROCESSING</span>
        </div>
        <div className="lc-report-card-pending">
          <h2>Your report is being prepared</h2>
          <p>
            It takes a few minutes to analyse your assessment. Ask Janet below —
            she can help while your report processes.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <RegenerateButton />
          </div>
        </div>
      </div>
    );
  }

  const bioAge = risk.biological_age;
  const delta =
    chronologicalAge != null ? +(bioAge - chronologicalAge).toFixed(1) : null;

  let headlineNode;
  if (delta == null) {
    headlineNode = (
      <>Your biological age is <em>{bioAge.toFixed(1)} years</em>.</>
    );
  } else if (delta <= -0.5) {
    headlineNode = (
      <>
        You&apos;re tracking <em>{Math.abs(delta).toFixed(1)} years younger</em>{" "}
        than your chronological age.
      </>
    );
  } else if (delta >= 0.5) {
    headlineNode = (
      <>
        Your biology is running{" "}
        <em className="older">{delta.toFixed(1)} years older</em> than your chronological age.
      </>
    );
  } else {
    headlineNode = (
      <>You&apos;re tracking <em>on schedule</em> with your chronological age.</>
    );
  }

  return (
    <div className="lc-report-card">
      <div className="lc-report-card-tab">
        <span className="lc-report-card-pill">Bio-Age Report</span>
        <span className="lc-report-card-date">
          {formatMonth(risk.assessment_date)}
        </span>
      </div>

      <h2 className="lc-report-card-headline">{headlineNode}</h2>

      <div className="lc-report-card-big">
        <div className="lc-report-card-bigN">
          {bioAge.toFixed(1)}
          <span className="u">yrs</span>
        </div>
        <div className="lc-report-card-compare">
          <span className="k">CHRONOLOGICAL</span>
          <span className="v">
            {chronologicalAge != null ? chronologicalAge.toFixed(0) : "—"}
          </span>
          {delta != null && (
            <span
              className={`delta ${delta < 0 ? "younger" : delta > 0 ? "older" : ""}`}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)} yrs
            </span>
          )}
        </div>
      </div>

      <div className="lc-report-card-rows">
        {DOMAINS.map((d) => {
          const value = risk[d.key];
          if (value == null) {
            return (
              <div key={d.key} className="lc-report-card-row">
                <span className="lbl">{d.label}</span>
                <div className="bar"><div className="fill" style={{ width: 0 }} /></div>
                <span className="val muted">—</span>
              </div>
            );
          }
          const band = bandFor(value);
          return (
            <div key={d.key} className="lc-report-card-row">
              <span className="lbl">{d.label}</span>
              <div className="bar">
                <div
                  className={`fill fill-${band.fill}`}
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
              <span className={`val ${band.fill}`}>{band.label.toUpperCase()}</span>
            </div>
          );
        })}
      </div>

      <div className="lc-report-card-foot">
        <span className="lc-report-card-foot-meta">
          {lastUpdated && `Last updated ${formatLastUpdated(lastUpdated)}`}
          {risk.confidence_level && (
            <>
              {lastUpdated ? " · " : ""}
              Confidence: {risk.confidence_level.toUpperCase()}
            </>
          )}
        </span>
        <RegenerateButton />
      </div>
    </div>
  );
}
