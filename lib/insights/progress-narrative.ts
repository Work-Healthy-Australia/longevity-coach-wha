type RiskScores = {
  biological_age: number | null;
  cv_risk: number | null;
  metabolic_risk: number | null;
  neuro_risk: number | null;
  onco_risk: number | null;
  msk_risk: number | null;
  assessment_date: string;
};

type ProgressResult = {
  headline: string;
  bullets: string[];
  trend: "improving" | "stable" | "declining" | "insufficient";
};

const DOMAINS = [
  { key: "cv_risk" as const, label: "cardiovascular" },
  { key: "metabolic_risk" as const, label: "metabolic" },
  { key: "neuro_risk" as const, label: "neurological" },
  { key: "onco_risk" as const, label: "oncological" },
  { key: "msk_risk" as const, label: "musculoskeletal" },
];

export function generateProgressNarrative(
  current: RiskScores,
  previous: RiskScores | null,
): ProgressResult {
  if (!previous) {
    return {
      headline: "This is your first assessment — future comparisons will appear here.",
      bullets: [],
      trend: "insufficient",
    };
  }

  const bullets: string[] = [];
  let improvements = 0;
  let regressions = 0;

  // Bio-age change
  if (current.biological_age != null && previous.biological_age != null) {
    const delta = current.biological_age - previous.biological_age;
    if (Math.abs(delta) >= 0.5) {
      if (delta < 0) {
        bullets.push(
          `Biological age improved by ${Math.abs(delta).toFixed(1)} years since your last assessment.`,
        );
        improvements++;
      } else {
        bullets.push(
          `Biological age increased by ${delta.toFixed(1)} years — review lifestyle factors below.`,
        );
        regressions++;
      }
    } else {
      bullets.push("Biological age is holding steady.");
    }
  }

  // Domain changes
  for (const d of DOMAINS) {
    const curr = current[d.key];
    const prev = previous[d.key];
    if (curr == null || prev == null) continue;

    const delta = curr - prev;
    if (delta <= -5) {
      bullets.push(
        `${capitalize(d.label)} risk dropped ${Math.abs(Math.round(delta))} points — good progress.`,
      );
      improvements++;
    } else if (delta >= 5) {
      bullets.push(
        `${capitalize(d.label)} risk rose ${Math.round(delta)} points — worth investigating.`,
      );
      regressions++;
    }
  }

  // Days between assessments
  const daysBetween = Math.round(
    (new Date(current.assessment_date).getTime() -
      new Date(previous.assessment_date).getTime()) /
      86_400_000,
  );
  if (daysBetween > 0) {
    bullets.push(`Based on ${daysBetween} days between assessments.`);
  }

  let trend: ProgressResult["trend"];
  if (improvements > regressions) trend = "improving";
  else if (regressions > improvements) trend = "declining";
  else trend = "stable";

  const headline =
    trend === "improving"
      ? "Your health metrics are trending in the right direction."
      : trend === "declining"
        ? "Some areas need attention since your last assessment."
        : "Your health profile is holding steady.";

  return { headline, bullets, trend };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
