// Builds a PatientInput from Supabase. Translates the questionnaire response
// shape (lib/questionnaire/schema.ts) and biomarker rows into the structure
// the deterministic engine expects.
//
// Key adapter: `cancer_history` (status: yes|no|unknown, entries[]) is
// translated into base-44's flat `family_history.cancer = { first_degree,
// second_degree, age_onset, types[] }` shape.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BloodPanel,
  DietType,
  FamilyHistory,
  Imaging,
  PatientInput,
  Sex,
  SmokingStatus,
  StressLevel,
  WearableData,
} from "./types";
import type {
  CancerHistoryEntry,
  CancerHistoryValue,
  CardConditionType,
  FamilyMemberCard,
  ResponsesByStep,
} from "@/lib/questionnaire/schema";

const FIRST_DEGREE_RELATIVES = new Set([
  "Mother",
  "Father",
  "Sister",
  "Brother",
]);

const SECOND_DEGREE_RELATIVES = new Set([
  "Maternal grandmother",
  "Maternal grandfather",
  "Paternal grandmother",
  "Paternal grandfather",
  "Aunt or uncle",
]);

// New lowercase relationship keys used by the per-relative card model.
// Distinct from FIRST/SECOND_DEGREE_RELATIVES which are Title-Case strings
// kept for the legacy multiselect path.
const FIRST_DEGREE_REL_KEYS = new Set<string>([
  "mother",
  "father",
  "sister",
  "brother",
]);
const SECOND_DEGREE_REL_KEYS = new Set<string>([
  "maternal_grandmother",
  "maternal_grandfather",
  "paternal_grandmother",
  "paternal_grandfather",
  "aunt",
  "uncle",
]);

const BIOMARKER_KEY_MAP: Record<string, keyof BloodPanel> = {
  apob: "apoB",
  apo_b: "apoB",
  "lp(a)": "lp_a",
  lp_a: "lp_a",
  lpa: "lp_a",
  ldl: "ldl",
  "ldl-c": "ldl",
  ldl_c: "ldl",
  hdl: "hdl",
  "hdl-c": "hdl",
  hdl_c: "hdl",
  triglycerides: "triglycerides",
  trig: "triglycerides",
  hscrp: "hsCRP",
  "hs-crp": "hsCRP",
  hs_crp: "hsCRP",
  homocysteine: "homocysteine",
  hba1c: "hba1c",
  "hba1c%": "hba1c",
  fasting_insulin: "fasting_insulin",
  insulin_fasting: "fasting_insulin",
  homa_ir: "HOMA_IR",
  "homa-ir": "HOMA_IR",
  fasting_glucose: "fasting_glucose",
  glucose_fasting: "fasting_glucose",
  uric_acid: "uric_acid",
  alt: "ALT",
  ggt: "GGT",
  vitamin_b12: "vitamin_B12",
  b12: "vitamin_B12",
  vitamin_d: "vitamin_D",
  "25oh_vitamin_d": "vitamin_D",
  omega3_index: "omega3_index",
  testosterone_total: "testosterone_total",
  total_testosterone: "testosterone_total",
  magnesium_rbc: "magnesium_rbc",
  rbc_magnesium: "magnesium_rbc",
  nlr: "neutrophil_lymphocyte_ratio",
  neutrophil_lymphocyte_ratio: "neutrophil_lymphocyte_ratio",
};

// Imaging-derived biomarkers that Janet may extract from a DEXA / cardiac CT /
// carotid ultrasound report. The lab_results writer is a single sink for any
// structured biomarker Janet finds — these keys are routed into
// `Biomarkers.imaging` instead of `BloodPanel` at assemble time.
const IMAGING_BIOMARKER_KEY_MAP: Record<string, keyof Imaging> = {
  visceral_fat_area: "visceral_fat_area_cm2",
  visceral_fat_area_cm2: "visceral_fat_area_cm2",
  vfa: "visceral_fat_area_cm2",
  coronary_calcium_score: "coronary_calcium_score",
  cac: "coronary_calcium_score",
  cac_score: "coronary_calcium_score",
  agatston: "coronary_calcium_score",
  carotid_imt: "carotid_IMT",
  carotid_imt_mm: "carotid_IMT",
  liver_fat_fraction: "liver_fat_fraction",
  liver_pdff: "liver_fat_fraction",
  dexa_t_score_spine: "DEXA_t_score_spine",
  t_score_spine: "DEXA_t_score_spine",
  t_score_lumbar: "DEXA_t_score_spine",
  dexa_t_score_hip: "DEXA_t_score_hip",
  t_score_hip: "DEXA_t_score_hip",
  t_score_femoral: "DEXA_t_score_hip",
};

const SMOKING_MAP: Record<string, SmokingStatus> = {
  Never: "never",
  "Former (>10 years ago)": "former_over_10y",
  "Former (<10 years ago)": "former_under_10y",
  Current: "current",
};

const ALCOHOL_MIDPOINTS: Record<string, number> = {
  None: 0,
  "1–7 units/week": 4,
  "8–14 units/week": 11,
  "15–21 units/week": 18,
  "21+ units/week": 25,
};

const EXERCISE_MIDPOINTS: Record<string, number> = {
  None: 0,
  "Light (<75 min/week)": 50,
  "Moderate (75–150 min/week)": 110,
  "Active (150–300 min/week)": 220,
  "Very active (300+ min/week)": 350,
};

const DIET_MAP: Record<string, DietType> = {
  Mediterranean: "mediterranean",
  "Whole food plant-based": "vegan",
  "Paleo/ancestral": "paleo",
  "Keto/low-carb": "keto",
  "Standard Western": "standard_western",
  Vegetarian: "vegetarian",
  Vegan: "vegan",
  Other: "other",
};

const STRESS_MAP: Record<string, StressLevel> = {
  Low: "low",
  Moderate: "moderate",
  High: "high",
  "Chronic/severe": "chronic",
};

function ageFromDob(dob: string | null | undefined): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

function sexFrom(s: unknown): Sex | undefined {
  if (s === "Male" || s === "male") return "male";
  if (s === "Female" || s === "female") return "female";
  return undefined;
}

/**
 * Translate the new `cancer_history` (Y/N/unknown + entries[]) into base-44's
 * flat shape. If `status !== "yes"` we return undefined (no signal). Otherwise
 * we infer first/second-degree presence from each entry's relatives, take the
 * youngest onsetAge across entries as `age_onset`, and collect distinct types.
 */
export function adaptCancerHistory(
  value: CancerHistoryValue | undefined,
): FamilyHistory["cancer"] | undefined {
  if (!value || value.status !== "yes" || !value.entries?.length) return undefined;

  let firstDegree = false;
  let secondDegree = false;
  let ageOnset: number | undefined;
  const types: string[] = [];

  value.entries.forEach((entry: CancerHistoryEntry) => {
    const rels = entry.relatives ?? [];
    rels.forEach((r) => {
      if (FIRST_DEGREE_RELATIVES.has(r)) firstDegree = true;
      else if (SECOND_DEGREE_RELATIVES.has(r)) secondDegree = true;
    });
    if (entry.onsetAge != null && !entry.onsetUnknown) {
      ageOnset = ageOnset == null ? entry.onsetAge : Math.min(ageOnset, entry.onsetAge);
    }
    const t = entry.type === "Other" || entry.type === "Don't know specific type"
      ? entry.otherText?.trim()
      : entry.type;
    if (t && !types.includes(t)) types.push(t);
  });

  return {
    first_degree: firstDegree,
    second_degree: secondDegree,
    age_onset: ageOnset,
    types,
  };
}

/**
 * Aggregate a per-condition `FamilyHistoryCondition` shape from the new
 * `family_members[]` cards. Pure / deterministic.
 *
 * - `first_degree`: at least one mother/father/sister/brother card has the condition.
 * - `second_degree`: at least one grandparent/aunt/uncle card has the condition.
 * - `age_onset`: minimum across all matching cards' `age_onset` (undefined if none provided).
 * - `multiple`: `true` only when ≥ 2 first-degree cards have the condition. This fixes
 *   the long-standing silent bug in `metabolic.ts` where the legacy multiselect path
 *   could not distinguish "Mother" from "Mother + Father".
 *
 * Returns `undefined` when no card has the condition.
 */
export function aggregateConditionFromMembers(
  members: FamilyMemberCard[],
  type: CardConditionType,
): { first_degree: boolean; second_degree: boolean; age_onset?: number; multiple: boolean } | undefined {
  const matched = members.flatMap((m) => {
    const entry = m.conditions?.find((c) => c.type === type);
    if (!entry) return [];
    return [{ relationship: m.relationship, age_onset: entry.age_onset }];
  });
  if (matched.length === 0) return undefined;
  const firstDegreeCount = matched.filter((m) => FIRST_DEGREE_REL_KEYS.has(m.relationship)).length;
  const secondDegree = matched.some((m) => SECOND_DEGREE_REL_KEYS.has(m.relationship));
  const ages = matched
    .map((m) => m.age_onset)
    .filter((a): a is number => typeof a === "number" && Number.isFinite(a));
  const out: { first_degree: boolean; second_degree: boolean; age_onset?: number; multiple: boolean } = {
    first_degree: firstDegreeCount > 0,
    second_degree: secondDegree,
    multiple: firstDegreeCount >= 2,
  };
  if (ages.length > 0) out.age_onset = Math.min(...ages);
  return out;
}

export function buildFamilyHistory(family: Record<string, unknown> | undefined): FamilyHistory {
  if (!family) return {};
  const fh: FamilyHistory = {};

  const membersRaw = (family as { family_members?: unknown }).family_members;
  const members: FamilyMemberCard[] = Array.isArray(membersRaw)
    ? (membersRaw as FamilyMemberCard[])
    : [];

  for (const type of ["cardiovascular", "neurodegenerative", "diabetes", "osteoporosis"] as const) {
    const agg = aggregateConditionFromMembers(members, type);
    if (agg) fh[type] = agg;
  }

  const cancer = adaptCancerHistory(family.cancer_history as CancerHistoryValue | undefined);
  if (cancer) fh.cancer = cancer;

  return fh;
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Map an array of biomarkers.lab_results rows (latest per code) into a flat
 * BloodPanel object the engine consumes. Imaging-flagged biomarkers (DEXA,
 * coronary calcium, etc.) are routed by `buildImagingFromLabResults` instead.
 */
export function buildBloodPanel(
  rows: Array<{ biomarker: string; value: number; test_date: string }>,
): BloodPanel {
  // Group by normalised key (lowercase, all non-alphanumerics → underscore),
  // keep the row with the latest test_date.
  const latest: Record<string, { value: number; test_date: string }> = {};
  rows.forEach((r) => {
    const key = r.biomarker.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!latest[key] || r.test_date > latest[key].test_date) {
      latest[key] = { value: r.value, test_date: r.test_date };
    }
  });

  const panel: BloodPanel = {};
  Object.entries(latest).forEach(([code, { value }]) => {
    // Skip imaging keys — they belong on Biomarkers.imaging.
    if (IMAGING_BIOMARKER_KEY_MAP[code]) return;
    const target = BIOMARKER_KEY_MAP[code];
    if (target) panel[target] = value;
  });
  return panel;
}

/**
 * Map an array of biomarkers.lab_results rows (latest per code) into a flat
 * Imaging object — used when Janet has extracted DEXA / cardiac CT / carotid
 * ultrasound values and persisted them via the lab_results writer.
 *
 * Normalises biomarker names by lowercasing then replacing any sequence of
 * non-alphanumeric characters with a single underscore so hyphens and spaces
 * map to the same key (e.g. "T-score Spine", "T score spine", "t_score_spine"
 * all resolve to "t_score_spine").
 */
export function buildImagingFromLabResults(
  rows: Array<{ biomarker: string; value: number; test_date: string }>,
): Imaging {
  const latest: Record<string, { value: number; test_date: string }> = {};
  rows.forEach((r) => {
    const key = r.biomarker.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!latest[key] || r.test_date > latest[key].test_date) {
      latest[key] = { value: r.value, test_date: r.test_date };
    }
  });
  const imaging: Imaging = {};
  Object.entries(latest).forEach(([code, { value }]) => {
    const target = IMAGING_BIOMARKER_KEY_MAP[code];
    if (target) imaging[target] = value;
  });
  return imaging;
}

/**
 * Estimate visceral fat area (cm²) from waist circumference when no DEXA
 * measurement is available. Sex-adjusted, based on the rough population
 * relationship: VFA ≈ k × (waist_cm − threshold). Used as a fallback only;
 * a real DEXA-derived value always wins.
 *
 * Threshold: 80 cm female, 90 cm male (IDF/AHA metabolic-syndrome cutoffs).
 * Slope: 5 — empirically calibrated so a male at waist 100 maps to ~50 cm²
 * (mid-band), at 110 maps to ~100 cm² (high-risk threshold).
 */
export function estimateVisceralFatFromWaist(
  waistCm: number,
  sex: Sex | undefined,
): number | undefined {
  if (!Number.isFinite(waistCm) || waistCm <= 0) return undefined;
  const threshold = sex === "female" ? 80 : 90;
  const slope = 5;
  const estimate = Math.max(0, (waistCm - threshold) * slope);
  return Math.round(estimate);
}

/**
 * Average the numeric wearable-relevant fields across the last 7 daily logs.
 */
export function buildWearableFromLogs(
  logs: Array<{
    hrv: number | null;
    resting_heart_rate: number | null;
    steps: number | null;
    sleep_hours: number | null;
    deep_sleep_pct?: number | null;
  }>,
): WearableData {
  if (!logs.length) return {};
  const avg = (vals: Array<number | null | undefined>): number | undefined => {
    const xs = vals.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (!xs.length) return undefined;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  const wd: WearableData = {};
  const hrv = avg(logs.map((l) => l.hrv));
  const rhr = avg(logs.map((l) => l.resting_heart_rate));
  const steps = avg(logs.map((l) => l.steps));
  const sleep = avg(logs.map((l) => l.sleep_hours));
  const deepSleepPct = avg(logs.map((l) => l.deep_sleep_pct));
  if (hrv != null) wd.hrv_rmssd = Math.round(hrv * 10) / 10;
  if (rhr != null) wd.resting_hr = Math.round(rhr);
  if (steps != null) wd.avg_daily_steps = Math.round(steps);
  if (sleep != null) wd.avg_sleep_duration = Math.round(sleep * 10) / 10;
  if (deepSleepPct != null) wd.avg_deep_sleep_pct = Math.round(deepSleepPct * 10) / 10;
  return wd;
}

export interface AssembleSources {
  profile: { date_of_birth: string | null; full_name?: string | null } | null;
  responses: ResponsesByStep | null;
  labResults: Array<{ biomarker: string; value: number; test_date: string }>;
  dailyLogs: Array<{ hrv: number | null; resting_heart_rate: number | null; steps: number | null; sleep_hours: number | null }>;
}

/**
 * Build a PatientInput from the raw DB sources. Pure function — broken out so
 * tests can call it without a Supabase client.
 */
export function buildPatientInput(sources: AssembleSources): PatientInput {
  const profile = sources.profile ?? { date_of_birth: null, full_name: null };
  const responses = sources.responses ?? {};

  const basics = (responses.basics ?? {}) as Record<string, unknown>;
  const medical = (responses.medical ?? {}) as Record<string, unknown>;
  const family = (responses.family ?? {}) as Record<string, unknown>;
  const lifestyle = (responses.lifestyle ?? {}) as Record<string, unknown>;

  const age = ageFromDob(profile.date_of_birth);
  const sex = sexFrom(basics.sex_at_birth);

  const bloodPanel = buildBloodPanel(sources.labResults);
  const imagingFromLabs = buildImagingFromLabResults(sources.labResults);
  const wearable = buildWearableFromLogs(sources.dailyLogs);

  // Self-reported VO₂max from the lifestyle step is layered on top of any
  // wearable-derived value (which today never exists — kept here for the day
  // a wearable OAuth integration lands). DEXA wins over self-report.
  const vo2maxSelfReport = num(lifestyle.vo2max_estimated);
  if (vo2maxSelfReport != null && wearable.vo2max_estimated == null) {
    wearable.vo2max_estimated = vo2maxSelfReport;
  }

  const waist = num(basics.waist_circumference_cm);
  const sexLifted = sexFrom(basics.sex_at_birth);
  // If no DEXA visceral fat is on file, fall back to a waist-derived estimate.
  if (imagingFromLabs.visceral_fat_area_cm2 == null && waist != null) {
    const est = estimateVisceralFatFromWaist(waist, sexLifted);
    if (est != null) imagingFromLabs.visceral_fat_area_cm2 = est;
  }

  const conditions = Array.isArray(medical.conditions)
    ? (medical.conditions as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const medications = typeof medical.medications === "string" && medical.medications.trim()
    ? medical.medications.split(/[,;\n]+/).map((m) => m.trim()).filter(Boolean)
    : [];

  const smoking = typeof lifestyle.smoking === "string" ? SMOKING_MAP[lifestyle.smoking] : undefined;
  const alcoholRaw = typeof lifestyle.alcohol === "string" ? ALCOHOL_MIDPOINTS[lifestyle.alcohol] : undefined;
  const exerciseRaw = typeof lifestyle.exercise_volume === "string"
    ? EXERCISE_MIDPOINTS[lifestyle.exercise_volume]
    : undefined;
  const dietRaw = typeof lifestyle.diet === "string" ? DIET_MAP[lifestyle.diet] : undefined;
  const stressRaw = typeof lifestyle.stress === "string" ? STRESS_MAP[lifestyle.stress] : undefined;

  return {
    patient_id: profile.full_name ?? undefined,
    demographics: {
      age,
      sex,
      height_cm: num(basics.height_cm),
      weight_kg: num(basics.weight_kg),
      systolic_bp_mmHg: num(basics.systolic_bp_mmHg),
      waist_circumference_cm: waist ?? undefined,
    },
    family_history: buildFamilyHistory(family),
    medical_history: {
      conditions,
      medications,
      allergies: [],
      surgeries: [],
    },
    lifestyle: {
      smoking_status: smoking,
      exercise_minutes_weekly: exerciseRaw,
      exercise_type: Array.isArray(lifestyle.exercise_type)
        ? lifestyle.exercise_type.join(", ")
        : typeof lifestyle.exercise_type === "string"
          ? lifestyle.exercise_type
          : undefined,
      sleep_hours: num(lifestyle.sleep_hours),
      diet_type: dietRaw,
      stress_level: stressRaw,
      alcohol_units_weekly: alcoholRaw,
    },
    biomarkers: {
      blood_panel: bloodPanel,
      imaging: imagingFromLabs,
      genetic: {},
      hormonal: {},
      microbiome: {},
    },
    wearable_data: wearable,
  };
}

/**
 * Assemble a PatientInput from Supabase. Reads:
 *   - profiles (date_of_birth, full_name)
 *   - latest health_profiles.responses (completed)
 *   - all biomarkers.lab_results (latest per biomarker)
 *   - last 7 days of biomarkers.daily_logs
 *
 * Pass an admin (service-role) client to bypass RLS — pipeline writers run
 * server-side and need to read across tables.
 */
export async function assemblePatientFromDB(
  supabase: SupabaseClient,
  userId: string,
): Promise<PatientInput> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [profileRes, healthRes, labsRes, logsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("date_of_birth, full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("health_profiles")
      .select("responses, completed_at")
      .eq("user_uuid", userId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("biomarkers")
      .from("lab_results")
      .select("biomarker, value, test_date")
      .eq("user_uuid", userId),
    supabase
      .schema("biomarkers")
      .from("daily_logs")
      .select("hrv, resting_heart_rate, steps, sleep_hours, deep_sleep_pct")
      .eq("user_uuid", userId)
      .gte("log_date", sevenDaysAgo),
  ]);

  return buildPatientInput({
    profile: (profileRes.data as { date_of_birth: string | null; full_name: string | null } | null) ?? null,
    responses: (healthRes.data?.responses as ResponsesByStep | null) ?? null,
    labResults: (labsRes.data ?? []) as Array<{ biomarker: string; value: number; test_date: string }>,
    dailyLogs: (logsRes.data ?? []) as Array<{ hrv: number | null; resting_heart_rate: number | null; steps: number | null; sleep_hours: number | null }>,
  });
}
