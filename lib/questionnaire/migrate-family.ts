// Hydration shim: maps legacy `family` + `family_deaths` step keys into the
// new `family_members[]` per-relative card shape. Pure function, read-only —
// the calling code stores the result on responses.family.family_members if
// (and only if) one isn't already present.
//
// Contract:
//   - If responses.family.family_members is already a non-empty array, return
//     it as-is. The shim is short-circuited so a member's edits are never
//     overwritten by re-derivation from the legacy keys.
//   - Otherwise, walk both legacy paths and merge per-relationship into a
//     single FamilyMemberCard. The legacy `_onset_age` is the earliest age
//     across the multiselect — applied to ALL cards mentioning that condition
//     (best-faith approximation; the member can edit).
//   - Cause-of-death free text is mapped via simple regex to a CauseCategory.
//     Empty / null cause leaves cause_category undefined (NOT "unknown").
//
// Legacy `"Aunt or uncle"` from the multiselect cannot be split — it maps to
// a single card with `relationship: "aunt"` (the member can edit to "uncle"
// if needed).

import type {
  CardConditionType,
  CauseCategory,
  FamilyMemberCard,
  FamilyRelationship,
  ResponsesByStep,
} from "./schema";

// Legacy Title-Case relationship label → new lowercase enum.
const REL_LABEL_MAP: Record<string, FamilyRelationship> = {
  Mother: "mother",
  Father: "father",
  Sister: "sister",
  Brother: "brother",
  "Maternal grandmother": "maternal_grandmother",
  "Maternal grandfather": "maternal_grandfather",
  "Paternal grandmother": "paternal_grandmother",
  "Paternal grandfather": "paternal_grandfather",
  // "Aunt or uncle" cannot be disambiguated from the legacy multiselect →
  // collapse to a single "aunt" card; member can edit to "uncle" if desired.
  "Aunt or uncle": "aunt",
};

const LEGACY_DEATH_RELATIVES: Array<{
  prefix: string;
  relationship: FamilyRelationship;
}> = [
  { prefix: "mother", relationship: "mother" },
  { prefix: "father", relationship: "father" },
  { prefix: "maternal_grandmother", relationship: "maternal_grandmother" },
  { prefix: "maternal_grandfather", relationship: "maternal_grandfather" },
  { prefix: "paternal_grandmother", relationship: "paternal_grandmother" },
  { prefix: "paternal_grandfather", relationship: "paternal_grandfather" },
];

// Maps the four condition multiselect roots to their CardConditionType.
const LEGACY_CONDITION_FIELDS: Array<{
  relativesKey: string;
  ageKey: string;
  type: CardConditionType;
}> = [
  {
    relativesKey: "cardiovascular_relatives",
    ageKey: "cardiovascular_onset_age",
    type: "cardiovascular",
  },
  {
    relativesKey: "neurodegenerative_relatives",
    ageKey: "neurodegenerative_onset_age",
    type: "neurodegenerative",
  },
  {
    relativesKey: "diabetes_relatives",
    ageKey: "diabetes_onset_age",
    type: "diabetes",
  },
  {
    relativesKey: "osteoporosis_relatives",
    ageKey: "osteoporosis_onset_age",
    type: "osteoporosis",
  },
];

/**
 * Map a legacy free-text cause-of-death string to a CauseCategory. Returns
 * `undefined` for empty input so the caller leaves the field unset rather
 * than guessing "unknown".
 */
export function categoriseCauseOfDeath(raw: unknown): CauseCategory | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  // Order matters: more specific patterns before general fallbacks.
  if (/heart|cardiac|cardiovascular|infarct|\bMI\b|myocardial/i.test(text)) {
    return "cardiovascular";
  }
  if (/cancer|tumor|tumour|leukaemia|lymphoma|melanoma/i.test(text)) {
    return "cancer";
  }
  if (/stroke/i.test(text)) {
    return "neurovascular";
  }
  if (/alzheimer|dementia|parkinson|\bALS\b|motor neurone/i.test(text)) {
    return "neurodegenerative";
  }
  if (/accident|trauma|crash|fall/i.test(text)) {
    return "trauma_accident";
  }
  if (/suicide|mental health/i.test(text)) {
    return "suicide_mental_health";
  }
  return "unknown";
}

function toFiniteNumber(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function newId(): string {
  // Node 20+ / browsers — crypto.randomUUID() is server-safe in our runtime.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "card-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

function blankCard(relationship: FamilyRelationship): FamilyMemberCard {
  return {
    id: newId(),
    relationship,
    is_alive: true,
    conditions: [],
  };
}

/**
 * Pure hydration: derive a `FamilyMemberCard[]` from any combination of
 * legacy `family.*_relatives` multiselects and `family_deaths.*_status` /
 * `_age` / `_cause_of_death` keys.
 *
 * Idempotency / addendum #5: if `responses.family.family_members` is already
 * a non-empty array, return it untouched.
 */
export function migrateLegacyFamily(
  responses: ResponsesByStep | null | undefined,
): FamilyMemberCard[] {
  const family = (responses?.family ?? {}) as Record<string, unknown>;
  const deaths = (responses?.family_deaths ?? {}) as Record<string, unknown>;

  // Short-circuit: if cards already exist, return them verbatim. Member edits
  // win over re-derived legacy data.
  const existing = family.family_members;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing as FamilyMemberCard[];
  }

  // Build cards keyed by relationship. We collapse repeated mentions of the
  // same relationship into one card (the legacy schema has no notion of two
  // aunts, two uncles, etc.).
  const byRelationship = new Map<FamilyRelationship, FamilyMemberCard>();

  function ensureCard(rel: FamilyRelationship): FamilyMemberCard {
    let c = byRelationship.get(rel);
    if (!c) {
      c = blankCard(rel);
      byRelationship.set(rel, c);
    }
    return c;
  }

  // 1) Vital-status / age / cause from family_deaths.
  for (const { prefix, relationship } of LEGACY_DEATH_RELATIVES) {
    const status = deaths[`${prefix}_status`];
    if (typeof status !== "string" || !status.trim()) continue;
    const card = ensureCard(relationship);
    const age = toFiniteNumber(deaths[`${prefix}_age`]);
    const cause = categoriseCauseOfDeath(deaths[`${prefix}_cause_of_death`]);
    if (status.toLowerCase() === "deceased") {
      card.is_alive = false;
      if (age !== undefined) card.age_at_death = age;
      if (cause !== undefined) card.cause_category = cause;
    } else if (status.toLowerCase() === "alive") {
      card.is_alive = true;
      if (age !== undefined) card.current_age = age;
    }
    // Other statuses ("Unknown") leave the defaults intact.
  }

  // 2) Per-condition multiselects → condition entries on the matching cards.
  for (const { relativesKey, ageKey, type } of LEGACY_CONDITION_FIELDS) {
    const relsRaw = family[relativesKey];
    if (!Array.isArray(relsRaw)) continue;
    const labels = relsRaw.filter((r): r is string => typeof r === "string");
    if (labels.length === 0 || labels.includes("None")) continue;
    const onsetAge = toFiniteNumber(family[ageKey]);

    for (const label of labels) {
      const rel = REL_LABEL_MAP[label];
      if (!rel) continue;
      const card = ensureCard(rel);
      // Don't duplicate the same condition if it's already present.
      if (card.conditions.find((c) => c.type === type)) continue;
      card.conditions.push(
        onsetAge !== undefined ? { type, age_onset: onsetAge } : { type },
      );
    }
  }

  return Array.from(byRelationship.values());
}
