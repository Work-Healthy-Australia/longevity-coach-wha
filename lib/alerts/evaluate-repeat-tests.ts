import type { AlertDraft } from "./evaluate-lab-alerts";

export type RepeatTestInputs = {
  recommendedScreenings: string[];
  /** Unique biomarker names with a row in the last 12 months. */
  recentLabBiomarkers: string[];
};

/**
 * Heuristic mapping from a screening name to keyword tokens that should
 * appear (as whole tokens) in a recent biomarker name to consider that
 * screening "covered". Imperfect by design — a typed `screening_id` column
 * would replace this in a future iteration.
 */
export const SCREENING_KEYWORDS: Record<string, readonly string[]> = {
  "thyroid panel": ["thyroid", "tsh", "t3", "t4"],
  "lipid panel": ["ldl", "hdl", "cholesterol", "triglycerides", "apob"],
  "kidney panel": ["creatinine", "egfr", "urea", "bun"],
  "liver panel": ["alt", "ast", "ggt", "alp", "bilirubin"],
  "iron panel": ["iron", "ferritin", "transferrin", "tibc"],
  "hba1c": ["hba1c", "glycated"],
  "fasting glucose": ["glucose", "fasting"],
  "vitamin d": ["vitamin"],
  "b12": ["b12", "cobalamin"],
  "homocysteine": ["homocysteine"],
  "inflammatory panel": ["crp", "esr"],
};

function tokenise(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Pure function. For each recommended screening, decides whether any recent
 * biomarker covers it via WHOLE-TOKEN matching (never substring matching), and
 * emits an `info` alert when not covered.
 *
 * Caller is expected to have normalised (trim + lowercase) and deduped the
 * `recommendedScreenings` list — but we defensively normalise again here.
 */
export function evaluateRepeatTests(inputs: RepeatTestInputs): AlertDraft[] {
  const { recommendedScreenings, recentLabBiomarkers } = inputs;
  if (recommendedScreenings.length === 0) return [];

  const biomarkerTokenSets = recentLabBiomarkers.map(
    (name) => new Set(tokenise(name)),
  );

  const drafts: AlertDraft[] = [];
  const seenSourceIds = new Set<string>();

  for (const rawScreening of recommendedScreenings) {
    const normalised = rawScreening.trim().toLowerCase();
    if (!normalised) continue;
    if (seenSourceIds.has(normalised)) continue;

    const mappedKeywords = SCREENING_KEYWORDS[normalised];
    const keywords = mappedKeywords
      ? [...mappedKeywords]
      : tokenise(normalised).filter((tok) => tok.length >= 3);

    let covered = false;
    for (const tokenSet of biomarkerTokenSets) {
      if (keywords.some((kw) => tokenSet.has(kw))) {
        covered = true;
        break;
      }
    }

    if (covered) continue;

    seenSourceIds.add(normalised);
    drafts.push({
      alert_type: "repeat_test",
      severity: "info",
      source_id: normalised,
      title: `You're due for ${rawScreening.trim()}`,
      body: `Atlas recommended ${rawScreening.trim()}. We have no recent lab data on file for this. Upload a recent panel or book one with your GP.`,
      link_href: "/uploads",
    });
  }

  return drafts;
}
