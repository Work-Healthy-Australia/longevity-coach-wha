/**
 * Deterministic supplement catalog resolver.
 *
 * Pure: no DB calls. The caller passes the catalog in (loaded via lib/supplements/loader.ts).
 * Same input always produces the same output.
 */

export type EvidenceTag = "A" | "B" | "C";

export type Domain =
  | "cardiovascular"
  | "metabolic"
  | "neurodegenerative"
  | "oncological"
  | "musculoskeletal"
  | "general";

export type SupplementCatalogItem = {
  id: string;
  sku: string;
  display_name: string;
  canonical_dose: string;
  timing_default: string | null;
  evidence_tag: EvidenceTag;
  domain: Domain;
  triggers_when: Record<string, number>;
  contraindicates: string[];
  cost_aud_month: number | null;
  notes: string | null;
};

export type EngineFactor = { name: string; raw_value: number | null };

export type EngineDomainScore = {
  score: number;
  factors: EngineFactor[];
};

export type EngineOutputForCatalog = {
  chronological_age: number | null;
  domains: {
    cardiovascular: EngineDomainScore;
    metabolic: EngineDomainScore;
    neurodegenerative: EngineDomainScore;
    oncological: EngineDomainScore;
    musculoskeletal: EngineDomainScore;
  };
  domain_weights: Record<string, number>;
};

/**
 * Map the score-style predicate prefix to the engine domain key.
 * Used for `<x>_score_gt` / `<x>_score_lt` predicates.
 */
const SCORE_PREDICATE_DOMAIN: Record<string, keyof EngineOutputForCatalog["domains"]> = {
  cv: "cardiovascular",
  metabolic: "metabolic",
  neuro: "neurodegenerative",
  onco: "oncological",
  msk: "musculoskeletal",
};

const EVIDENCE_MULTIPLIER: Record<EvidenceTag, number> = { A: 3, B: 2, C: 1 };

function findFactorValue(
  engineOutput: EngineOutputForCatalog,
  factorName: string,
): number | null {
  for (const domainKey of Object.keys(engineOutput.domains) as Array<keyof EngineOutputForCatalog["domains"]>) {
    const domain = engineOutput.domains[domainKey];
    if (!domain || !Array.isArray(domain.factors)) continue;
    for (const f of domain.factors) {
      if (f.name === factorName && typeof f.raw_value === "number") {
        return f.raw_value;
      }
    }
  }
  return null;
}

/**
 * Evaluate a single predicate key/value pair against the engine output.
 * Returns false if the underlying value cannot be resolved.
 */
function evaluatePredicate(
  key: string,
  threshold: number,
  engineOutput: EngineOutputForCatalog,
): boolean {
  const isGt = key.endsWith("_gt");
  const isLt = key.endsWith("_lt");
  if (!isGt && !isLt) return false;
  const compare = (value: number | null): boolean => {
    if (value === null || value === undefined || Number.isNaN(value)) return false;
    return isGt ? value > threshold : value < threshold;
  };

  // Age predicates
  if (key === "age_gt" || key === "age_lt") {
    return compare(engineOutput.chronological_age ?? null);
  }

  // Domain-score predicates: <prefix>_score_gt / <prefix>_score_lt
  const scoreMatch = key.match(/^([a-z]+)_score_(gt|lt)$/);
  if (scoreMatch) {
    const prefix = scoreMatch[1];
    const domainKey = SCORE_PREDICATE_DOMAIN[prefix];
    if (!domainKey) return false;
    const score = engineOutput.domains[domainKey]?.score;
    return compare(typeof score === "number" ? score : null);
  }

  // Factor-based predicates: strip the suffix and search the factors arrays.
  const factorName = key.replace(/_(gt|lt)$/, "");
  return compare(findFactorValue(engineOutput, factorName));
}

/**
 * Multiple keys in `triggers_when` are OR-combined: any single match fires.
 * An empty `triggers_when` never fires (item is not recommended).
 */
function triggersFire(
  triggers: Record<string, number>,
  engineOutput: EngineOutputForCatalog,
): boolean {
  const keys = Object.keys(triggers ?? {});
  if (keys.length === 0) return false;
  for (const key of keys) {
    if (evaluatePredicate(key, triggers[key], engineOutput)) return true;
  }
  return false;
}

/**
 * Returns true if the item conflicts with any of the patient's medications.
 * Case-insensitive substring match on either side.
 */
function isContraindicated(item: SupplementCatalogItem, memberMedications: string[]): boolean {
  if (!item.contraindicates?.length || !memberMedications?.length) return false;
  const meds = memberMedications.map((m) => m.toLowerCase());
  for (const c of item.contraindicates) {
    const needle = c.toLowerCase();
    if (meds.some((m) => m.includes(needle))) return true;
  }
  return false;
}

function rankScore(item: SupplementCatalogItem, weights: Record<string, number>): number {
  const w = weights[item.domain] ?? 0;
  return w * EVIDENCE_MULTIPLIER[item.evidence_tag];
}

const MAX_RESULTS = 8;
const MAX_GENERAL_FALLBACK = 2;

/**
 * Recommend supplements deterministically from a risk-engine output.
 *
 * Steps:
 *   1. Filter to items whose triggers fire on this engine output.
 *   2. Drop items contraindicated by any member medication.
 *   3. Rank by domain_weight × evidence multiplier (A=3, B=2, C=1).
 *   4. Stable secondary sort by SKU for determinism on ties.
 *   5. Take top 8.
 *
 * If nothing fires (pristine engine output), return up to two general items
 * with non-empty triggers ranked by evidence (A first), again sorted by SKU.
 */
export function recommendFromRisk(
  engineOutput: EngineOutputForCatalog,
  catalog: SupplementCatalogItem[],
  memberMedications: string[] = [],
): SupplementCatalogItem[] {
  if (!catalog?.length) return [];

  const safe = catalog.filter((item) => !isContraindicated(item, memberMedications));

  const fired = safe.filter((item) => triggersFire(item.triggers_when, engineOutput));

  if (fired.length === 0) {
    // Pristine fallback: a small handful of general items, evidence-ordered.
    const general = safe
      .filter((i) => i.domain === "general")
      .sort((a, b) => {
        const ev = EVIDENCE_MULTIPLIER[b.evidence_tag] - EVIDENCE_MULTIPLIER[a.evidence_tag];
        if (ev !== 0) return ev;
        return a.sku.localeCompare(b.sku);
      });
    return general.slice(0, MAX_GENERAL_FALLBACK);
  }

  fired.sort((a, b) => {
    const r = rankScore(b, engineOutput.domain_weights) - rankScore(a, engineOutput.domain_weights);
    if (r !== 0) return r;
    return a.sku.localeCompare(b.sku);
  });

  return fired.slice(0, MAX_RESULTS);
}

